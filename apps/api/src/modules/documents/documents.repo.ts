import type { Queryable } from '../../platform/db.js';

export async function getDocumentTypeByCode(db: Queryable, code: string) {
  const r = await db.query<{ id: string; code: string; name: string }>(`SELECT id, code, name FROM document_types WHERE code = $1 AND status = 'ACTIVE'`, [code]);
  return r.rows[0] ?? null;
}

export async function getNodeInProject(db: Queryable, projectId: string, nodeCode: string) {
  const r = await db.query<{ id: string; node_code: string }>(
    `SELECT n.id, n.node_code FROM workflow_node_instances n JOIN workflow_instances wi ON wi.id = n.workflow_instance_id
      WHERE wi.project_id = $1 AND n.node_code = $2`,
    [projectId, nodeCode],
  );
  return r.rows[0] ?? null;
}

/** Existing document previously attached to this node for this document type (upload = new version, never overwrite). */
export async function findNodeDocument(db: Queryable, projectId: string, nodeId: string, docTypeId: string) {
  const r = await db.query<{ id: string; current_version_no: number }>(
    `SELECT d.id, d.current_version_no FROM documents d
       JOIN document_versions v ON v.document_id = d.id
       JOIN evidence_links e ON e.document_version_id = v.id AND e.target_type = 'WORKFLOW_NODE' AND e.target_id = $2
      WHERE d.project_id = $1 AND d.document_type_id = $3 AND d.status = 'ACTIVE' LIMIT 1`,
    [projectId, nodeId, docTypeId],
  );
  return r.rows[0] ?? null;
}

export async function insertDocument(tx: Queryable, d: { projectId: string; docTypeId: string; title: string; classification: string; userId: string; at: Date }): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO documents (project_id, document_type_id, title, classification, current_version_no, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,1,$5,$6,$6) RETURNING id`,
    [d.projectId, d.docTypeId, d.title, d.classification, d.userId, d.at],
  );
  return r.rows[0]!.id;
}

export async function insertVersion(
  tx: Queryable,
  v: { documentId: string; versionNo: number; storageKey: string; mime: string; size: number; sha256: string; userId: string; metadata: Record<string, unknown>; at: Date },
): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO document_versions (document_id, version_no, storage_key, storage_provider, mime_type, size_bytes, sha256, uploaded_by, uploaded_at, metadata)
     VALUES ($1,$2,$3,'LOCAL',$4,$5,$6,$7,$8,$9) RETURNING id`,
    [v.documentId, v.versionNo, v.storageKey, v.mime, v.size, v.sha256, v.userId, v.at, JSON.stringify(v.metadata)],
  );
  return r.rows[0]!.id;
}

export async function bumpVersion(tx: Queryable, documentId: string, versionNo: number, at: Date): Promise<void> {
  await tx.query(`UPDATE documents SET current_version_no = $2, updated_at = $3 WHERE id = $1`, [documentId, versionNo, at]);
}

export async function insertEvidenceLink(tx: Queryable, l: { versionId: string; targetType: string; targetId: string; purpose: string; userId: string; at: Date }): Promise<void> {
  await tx.query(
    `INSERT INTO evidence_links (document_version_id, target_type, target_id, purpose, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [l.versionId, l.targetType, l.targetId, l.purpose, l.userId, l.at],
  );
}

export async function setRequiredDocStatus(tx: Queryable, projectId: string, nodeId: string, docTypeId: string, status: string): Promise<number> {
  const r = await tx.query(
    `UPDATE project_required_documents SET status = $4
      WHERE project_id = $1 AND workflow_node_instance_id = $2 AND document_type_id = $3 AND status <> 'NOT_APPLICABLE'`,
    [projectId, nodeId, docTypeId, status],
  );
  return r.rowCount ?? 0;
}

export interface DocRow {
  id: string;
  project_id: string;
  title: string;
  classification: string;
  status: string;
  current_version_no: number;
  document_type_code: string;
  document_type_name: string;
  document_type_id: string;
  version_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: Date;
  uploaded_by_name: string;
  filename: string | null;
  node_codes: string[];
  required_status: string | null;
}

const DOC_SELECT = `
  SELECT d.id, d.project_id, d.title, d.classification, d.status, d.current_version_no,
         dt.code AS document_type_code, dt.name AS document_type_name, dt.id AS document_type_id,
         v.id AS version_id, v.storage_key, v.mime_type, v.size_bytes, v.sha256, v.uploaded_at, u.display_name AS uploaded_by_name,
         v.metadata->>'filename' AS filename,
         COALESCE((SELECT array_agg(DISTINCT n.node_code) FROM evidence_links e
                     JOIN document_versions v2 ON v2.id = e.document_version_id AND v2.document_id = d.id
                     JOIN workflow_node_instances n ON n.id = e.target_id AND e.target_type = 'WORKFLOW_NODE'), '{}') AS node_codes,
         (SELECT prd.status FROM project_required_documents prd
            JOIN evidence_links e ON e.target_id = prd.workflow_node_instance_id AND e.target_type = 'WORKFLOW_NODE'
            JOIN document_versions v3 ON v3.id = e.document_version_id AND v3.document_id = d.id
           WHERE prd.project_id = d.project_id AND prd.document_type_id = d.document_type_id LIMIT 1) AS required_status
    FROM documents d
    JOIN document_types dt ON dt.id = d.document_type_id
    JOIN document_versions v ON v.document_id = d.id AND v.version_no = d.current_version_no
    JOIN app_users u ON u.id = v.uploaded_by`;

export async function listDocuments(db: Queryable, projectId: string): Promise<DocRow[]> {
  const r = await db.query<DocRow>(`${DOC_SELECT} WHERE d.project_id = $1 ORDER BY v.uploaded_at DESC`, [projectId]);
  return r.rows;
}

export async function getDocument(db: Queryable, id: string): Promise<DocRow | null> {
  const r = await db.query<DocRow>(`${DOC_SELECT} WHERE d.id = $1`, [id]);
  return r.rows[0] ?? null;
}

/** Nodes (in the document's project) this document is evidence for, with the required-doc slot it satisfies. */
export async function linkedRequirements(db: Queryable, documentId: string) {
  const r = await db.query<{ node_id: string; node_code: string; project_id: string; document_type_id: string }>(
    `SELECT DISTINCT n.id AS node_id, n.node_code, d.project_id, d.document_type_id
       FROM documents d
       JOIN document_versions v ON v.document_id = d.id
       JOIN evidence_links e ON e.document_version_id = v.id AND e.target_type = 'WORKFLOW_NODE'
       JOIN workflow_node_instances n ON n.id = e.target_id
      WHERE d.id = $1`,
    [documentId],
  );
  return r.rows;
}

export async function setDocumentStatus(tx: Queryable, id: string, status: string, at: Date): Promise<void> {
  await tx.query(`UPDATE documents SET status = $2, updated_at = $3 WHERE id = $1`, [id, status, at]);
}
