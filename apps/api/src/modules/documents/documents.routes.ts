import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { validation } from '../../platform/errors.js';
import * as service from './documents.service.js';

const Id = z.object({ id: z.string().uuid() });

export async function documentsRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: service.MAX_UPLOAD_BYTES, files: 1, fields: 10, fieldSize: 500 } });

  app.get('/projects/:id/documents', { preHandler: app.perm('project.read') }, async (req) =>
    service.listDocuments(app.db, req.ctx.actor!, Id.parse(req.params).id),
  );

  app.post('/projects/:id/documents', { preHandler: app.perm('document.upload') }, async (req, reply) => {
    const { id } = Id.parse(req.params);
    if (!req.isMultipart()) throw validation('Send multipart/form-data with a "file" part.');
    const fields: Record<string, string> = {};
    let stored: service.StoredUpload | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (stored) {
            part.file.resume();
            continue;
          }
          stored = await service.stashUpload(app.config.uploadDir, part.file, part.mimetype, part.filename || 'upload');
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 413) throw validation(`File exceeds ${service.MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, [{ field: 'file', message: 'File too large' }]);
      throw e;
    }
    if (!stored) throw validation('A file is required.', [{ field: 'file', message: 'Required' }]);
    const doc = await service.uploadDocument(app.db, req.ctx, app.config.uploadDir, id, fields, stored);
    reply.code(201);
    return doc;
  });

  app.post('/documents/:id/verify', { preHandler: app.perm('document.verify') }, async (req) => {
    const body = z.object({ status: z.enum(['VERIFIED', 'REJECTED']), note: z.string().max(1000).optional() }).parse(req.body);
    return service.verifyDocument(app.db, req.ctx, Id.parse(req.params).id, body.status, body.note);
  });

  app.get('/documents/:id/download', { preHandler: app.perm('project.read') }, async (req, reply) => {
    const d = await service.openDownload(app.db, req.ctx.actor!, app.config.uploadDir, Id.parse(req.params).id);
    reply
      .header('content-type', d.mime)
      .header('content-disposition', `attachment; filename="${d.filename.replace(/[^\w.\- ]/g, '_')}"`)
      .header('x-content-type-options', 'nosniff')
      .header('etag', `"${d.sha256}"`);
    return reply.send(d.stream);
  });
}
