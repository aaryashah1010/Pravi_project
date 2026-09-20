import type { AuditEntryDto } from '@infraflow/shared';
import type { Queryable } from '../../platform/db.js';
import { type Actor, hasGlobalScope } from '../../platform/context.js';
import { scopeClause } from '../projects/projects.repo.js';

export interface AuditFilter {
  projectId?: string;
  actorUserId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  before?: string; // ISO timestamp cursor (rows strictly older than this)
}

/**
 * Read-only view of the append-only audit log. Project-scoped rows are limited to projects the actor can see;
 * rows without a project (login events, etc.) are only visible to global-scope users.
 */
export async function listAudit(db: Queryable, actor: Actor, f: AuditFilter): Promise<AuditEntryDto[]> {
  const params: unknown[] = [];
  const scope = scopeClause(actor, 'p', params);
  const where: string[] = [hasGlobalScope(actor) ? `(a.project_id IS NULL OR ${scope})` : `(a.project_id IS NOT NULL AND ${scope})`];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (f.projectId) add('a.project_id = ?', f.projectId);
  if (f.actorUserId) add('a.actor_user_id = ?', f.actorUserId);
  if (f.action) add('a.action ILIKE ?', `${f.action}%`);
  if (f.from) add('a.created_at >= ?::timestamptz', f.from);
  if (f.to) add('a.created_at <= ?::timestamptz', f.to);
  if (f.before) add('a.created_at < ?::timestamptz', f.before);
  params.push(Math.min(f.limit ?? 50, 200));

  const r = await db.query(
    `SELECT a.id, a.created_at, a.action, a.entity_type, a.entity_id, a.project_id, p.project_code, u.display_name AS actor_name,
            a.actor_role_code, pos.position_code, pt.designation, a.request_id, a.metadata, a.new_data
       FROM audit_logs a
       LEFT JOIN projects p ON p.id = a.project_id
       LEFT JOIN app_users u ON u.id = a.actor_user_id
       LEFT JOIN positions pos ON pos.id = a.actor_position_id
       LEFT JOIN position_types pt ON pt.id = pos.position_type_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.created_at DESC, a.id DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((x) => ({
    id: x.id,
    at: x.created_at.toISOString(),
    action: x.action,
    entityType: x.entity_type,
    entityId: x.entity_id,
    projectId: x.project_id,
    projectCode: x.project_code,
    actorName: x.actor_name,
    actorRole: x.actor_role_code,
    actorPositionCode: x.position_code,
    actorDesignation: x.designation,
    requestId: x.request_id,
    metadata: x.metadata ?? {},
    newData: x.new_data,
  }));
}
