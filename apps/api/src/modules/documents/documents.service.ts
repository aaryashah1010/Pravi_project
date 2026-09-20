import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { type Db, type Queryable, withTx } from '../../platform/db.js';
import { type Actor, type RequestContext, can, hasGlobalScope } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { forbidden, notFound, validation } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import * as repo from './documents.repo.js';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'text/plain',
  'application/msword', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
};
const CLASSIFICATIONS = ['INTERNAL', 'RESTRICTED', 'CONFIDENTIAL'];

export interface StoredUpload {
  tmpPath: string;
  size: number;
  sha256: string;
  mime: string;
  filename: string;
}

/** Stream an upload to a temp file while hashing it. Never trusts the client-supplied name for any path. */
export async function stashUpload(uploadDir: string, file: Readable, mime: string, filename: string): Promise<StoredUpload> {
  if (!ALLOWED_MIME.has(mime)) throw validation(`File type ${mime} is not allowed.`, [{ field: 'file', message: 'Unsupported file type' }]);
  const tmpDir = path.join(uploadDir, '_tmp');
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, randomUUID());
  const hash = createHash('sha256');
  let size = 0;
  try {
    await pipeline(
      file,
      new Transform({
        transform(chunk, _enc, cb) {
          size += chunk.length;
          hash.update(chunk);
          cb(null, chunk);
        },
      }),
      createWriteStream(tmpPath),
    );
    if (size === 0) throw validation('The file is empty.', [{ field: 'file', message: 'Empty file' }]);
    const magic = MAGIC[mime];
    if (magic) {
      const fh = await open(tmpPath, 'r');
      try {
        const buf = Buffer.alloc(magic.length);
        await fh.read(buf, 0, magic.length, 0);
        if (!magic.every((b, i) => buf[i] === b)) throw validation('The file content does not match its declared type.', [{ field: 'file', message: 'Content/type mismatch' }]);
      } finally {
        await fh.close();
      }
    }
  } catch (e) {
    await rm(tmpPath, { force: true });
    throw e;
  }
  return { tmpPath, size, sha256: hash.digest('hex'), mime, filename: path.basename(filename).slice(0, 200) };
}

export interface DocumentDto {
  id: string;
  projectId: string;
  title: string;
  documentType: { code: string; name: string };
  classification: string;
  versionNo: number;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
  status: string;
  filename: string | null;
  linkedNodes: string[];
  requirementStatus: string | null;
}

const toDto = (d: repo.DocRow): DocumentDto => ({
  id: d.id,
  projectId: d.project_id,
  title: d.title,
  documentType: { code: d.document_type_code, name: d.document_type_name },
  classification: d.classification,
  versionNo: d.current_version_no,
  mimeType: d.mime_type,
  sizeBytes: Number(d.size_bytes),
  sha256: d.sha256,
  uploadedBy: d.uploaded_by_name,
  uploadedAt: d.uploaded_at.toISOString(),
  status: d.status,
  filename: d.filename,
  linkedNodes: d.node_codes,
  requirementStatus: d.required_status,
});

/** Contractors (no department/global scope) never see internal-only classifications (threat model 5). */
function canReadClassification(actor: Actor, classification: string): boolean {
  if (hasGlobalScope(actor) || actor.roles.some((r) => r.code !== 'CONTRACTOR' && r.organizationId)) return true;
  return classification === 'PUBLIC' || classification === 'INTERNAL' ? true : false;
}

export async function listDocuments(db: Queryable, actor: Actor, projectId: string): Promise<DocumentDto[]> {
  if (!(await projects.getProject(db, projectId, actor))) throw notFound('Project');
  const rows = await repo.listDocuments(db, projectId);
  return rows.filter((d) => canReadClassification(actor, d.classification)).map(toDto);
}

export async function uploadDocument(
  db: Db,
  ctx: RequestContext,
  uploadDir: string,
  projectId: string,
  fields: { documentTypeCode?: string; nodeCode?: string; title?: string; classification?: string; inspectionId?: string; latitude?: string; longitude?: string },
  file: StoredUpload,
): Promise<DocumentDto> {
  const actor = ctx.actor!;
  let finalPath: string | null = null;
  try {
    const docId = await withTx(db, async (tx) => {
      const project = await projects.getProject(tx, projectId, actor);
      if (!project) throw notFound('Project');
      if (!fields.documentTypeCode) throw validation('documentTypeCode is required.', [{ field: 'documentTypeCode', message: 'Required' }]);
      const type = await repo.getDocumentTypeByCode(tx, fields.documentTypeCode);
      if (!type) throw validation('Unknown document type.', [{ field: 'documentTypeCode', message: 'Unknown document type' }]);
      const classification = fields.classification ?? 'INTERNAL';
      if (!CLASSIFICATIONS.includes(classification) && !(classification === 'PUBLIC' && can(actor, 'workflow.manage'))) {
        throw validation('Invalid classification.', [{ field: 'classification', message: 'Use INTERNAL, RESTRICTED or CONFIDENTIAL' }]);
      }
      const node = fields.nodeCode ? await repo.getNodeInProject(tx, projectId, fields.nodeCode) : null;
      if (fields.nodeCode && !node) throw validation('Unknown workflow node for this project.', [{ field: 'nodeCode', message: 'Unknown node' }]);

      let inspectionId: string | null = null;
      if (fields.inspectionId) {
        const insp = await tx.query<{ id: string }>(`SELECT id FROM inspections WHERE id = $1 AND project_id = $2`, [fields.inspectionId, projectId]);
        if (!insp.rowCount) throw validation('Unknown inspection for this project.', [{ field: 'inspectionId', message: 'Unknown inspection' }]);
        inspectionId = insp.rows[0]!.id;
      }
      const lat = fields.latitude !== undefined && fields.latitude !== '' ? Number(fields.latitude) : null;
      const lon = fields.longitude !== undefined && fields.longitude !== '' ? Number(fields.longitude) : null;
      if ((lat !== null && !(lat >= -90 && lat <= 90)) || (lon !== null && !(lon >= -180 && lon <= 180))) {
        throw validation('Invalid coordinates.', [{ field: 'latitude', message: 'Latitude/longitude out of range' }]);
      }

      const existing = node ? await repo.findNodeDocument(tx, projectId, node.id, type.id) : null;
      const title = (fields.title?.trim() || file.filename || type.name).slice(0, 200);
      const documentId = existing?.id ?? (await repo.insertDocument(tx, { projectId, docTypeId: type.id, title, classification, userId: actor.userId, at: ctx.now }));
      const versionNo = existing ? existing.current_version_no + 1 : 1;
      const storageKey = `${projectId}/${documentId}/${versionNo}-${file.sha256.slice(0, 16)}`;
      const versionId = await repo.insertVersion(tx, {
        documentId, versionNo, storageKey, mime: file.mime, size: file.size, sha256: file.sha256, userId: actor.userId,
        metadata: { filename: file.filename, ...(lat !== null && lon !== null ? { latitude: lat, longitude: lon } : {}) }, at: ctx.now,
      });
      if (existing) await repo.bumpVersion(tx, documentId, versionNo, ctx.now);
      if (inspectionId) {
        await repo.insertEvidenceLink(tx, { versionId, targetType: 'INSPECTION', targetId: inspectionId, purpose: type.code, userId: actor.userId, at: ctx.now });
      }
      if (node) {
        await repo.insertEvidenceLink(tx, { versionId, targetType: 'WORKFLOW_NODE', targetId: node.id, purpose: type.code, userId: actor.userId, at: ctx.now });
        await repo.setRequiredDocStatus(tx, projectId, node.id, type.id, 'SUBMITTED');
      }
      await audit(tx, ctx, {
        action: 'document.uploaded', entityType: 'document', entityId: documentId, projectId,
        newData: { type: type.code, versionNo, sha256: file.sha256, size: file.size, node: node?.node_code ?? null, classification },
      });
      await emit(tx, ctx, {
        aggregateType: 'PROJECT', aggregateId: projectId, eventType: 'DocumentUploaded',
        payload: { documentId, projectCode: project.project_code, documentType: type.code, versionNo, nodeCode: node?.node_code ?? null },
      });

      // Move the bytes into place last; if the transaction later fails the finally-block removes the orphan.
      const abs = resolveStoragePath(uploadDir, storageKey);
      await mkdir(path.dirname(abs), { recursive: true });
      await rename(file.tmpPath, abs);
      finalPath = abs;
      return documentId;
    });
    const doc = await repo.getDocument(db, docId);
    return toDto(doc!);
  } catch (e) {
    if (finalPath) await rm(finalPath, { force: true });
    await rm(file.tmpPath, { force: true });
    throw e;
  }
}

export function resolveStoragePath(uploadDir: string, storageKey: string): string {
  const abs = path.resolve(uploadDir, storageKey);
  if (!abs.startsWith(path.resolve(uploadDir) + path.sep)) throw new Error('Invalid storage key');
  return abs;
}

/** VERIFIED/REJECTED updates every requirement slot this document is evidence for. Rejection needs a reason. */
export async function verifyDocument(db: Db, ctx: RequestContext, documentId: string, status: 'VERIFIED' | 'REJECTED', note?: string): Promise<DocumentDto> {
  const actor = ctx.actor!;
  if (status === 'REJECTED' && (!note || note.trim().length < 5)) {
    throw validation('A reason is required to reject a document.', [{ field: 'note', message: 'Enter a reason (min 5 characters).' }]);
  }
  await withTx(db, async (tx) => {
    const doc = await repo.getDocument(tx, documentId);
    if (!doc || !(await projects.getProject(tx, doc.project_id, actor))) throw notFound('Document');
    const links = await repo.linkedRequirements(tx, documentId);
    for (const l of links) await repo.setRequiredDocStatus(tx, l.project_id, l.node_id, l.document_type_id, status);
    await audit(tx, ctx, {
      action: `document.${status.toLowerCase()}`, entityType: 'document', entityId: documentId, projectId: doc.project_id,
      newData: { status, versionNo: doc.current_version_no }, metadata: { note: note ?? null, nodes: links.map((l) => l.node_code) },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: doc.project_id, eventType: status === 'VERIFIED' ? 'DocumentVerified' : 'DocumentRejected',
      payload: { documentId, documentType: doc.document_type_code, note: note ?? null, uploadedBy: doc.uploaded_by_name },
    });
  });
  return toDto((await repo.getDocument(db, documentId))!);
}

export async function openDownload(db: Queryable, actor: Actor, uploadDir: string, documentId: string) {
  const doc = await repo.getDocument(db, documentId);
  if (!doc || !(await projects.getProject(db, doc.project_id, actor))) throw notFound('Document');
  if (!canReadClassification(actor, doc.classification)) throw forbidden('This document is not available to your role.');
  const abs = resolveStoragePath(uploadDir, doc.storage_key);
  try {
    await stat(abs);
  } catch {
    throw notFound('Document file');
  }
  return { stream: createReadStream(abs), mime: doc.mime_type, filename: doc.filename ?? `${doc.document_type_code}-${doc.current_version_no}`, sha256: doc.sha256 };
}
