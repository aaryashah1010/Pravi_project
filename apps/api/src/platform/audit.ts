import type { Queryable } from './db.js';
import { type RequestContext, roleCodeFor } from './context.js';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  projectId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  metadata?: Record<string, unknown>;
  actorPositionId?: string | null;
}

/** Append an immutable audit row inside the caller's transaction. Uses ctx.now so backdated seeding stays consistent. */
export async function audit(tx: Queryable, ctx: RequestContext, e: AuditEntry): Promise<void> {
  await tx.query(
    `INSERT INTO audit_logs (request_id, actor_user_id, actor_position_id, actor_role_code, action, entity_type, entity_id,
                             project_id, old_data, new_data, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      ctx.requestId,
      ctx.actor?.userId ?? null,
      e.actorPositionId ?? null,
      roleCodeFor(ctx.actor),
      e.action,
      e.entityType,
      e.entityId ?? null,
      e.projectId ?? null,
      e.oldData === undefined ? null : JSON.stringify(e.oldData),
      e.newData === undefined ? null : JSON.stringify(e.newData),
      JSON.stringify(e.metadata ?? {}),
      ctx.now,
    ],
  );
}
