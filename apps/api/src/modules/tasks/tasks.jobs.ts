import { type Db, withTx } from '../../platform/db.js';
import { systemContext } from '../../platform/context.js';
import { emit } from '../../platform/events.js';
import { audit } from '../../platform/audit.js';
import { recompute } from '../workflows/workflows.service.js';

/**
 * Mark open tasks past their configured due date OVERDUE (once), publish TaskOverdue, and refresh the affected projects'
 * health (AT_RISK). Idempotent; safe to run on an interval. Due dates come from configured SLAs, not statute.
 */
export async function tickOverdue(db: Db, now: Date = new Date()): Promise<{ marked: number }> {
  return withTx(db, async (tx) => {
    const ctx = systemContext(now);
    const r = await tx.query(
      `UPDATE tasks t SET status = 'OVERDUE', version_no = t.version_no + 1, updated_at = $1
         FROM projects p
        WHERE p.id = t.project_id AND t.status IN ('PENDING','IN_PROGRESS') AND t.due_at IS NOT NULL AND t.due_at < $1
        RETURNING t.id, t.project_id, t.title, t.task_type, t.assigned_position_id, t.assigned_user_id, p.project_code`,
      [now],
    );
    const projects = new Set<string>();
    for (const t of r.rows) {
      projects.add(t.project_id);
      await emit(tx, ctx, {
        aggregateType: 'PROJECT', aggregateId: t.project_id, eventType: 'TaskOverdue',
        payload: { taskId: t.id, title: t.title, taskType: t.task_type, projectCode: t.project_code, positionId: t.assigned_position_id, userId: t.assigned_user_id, link: `/projects/${t.project_id}` },
      });
    }
    if (r.rows.length) await audit(tx, ctx, { action: 'tasks.marked_overdue', entityType: 'task', metadata: { count: r.rows.length } });
    for (const pid of projects) await recompute(tx, ctx, pid);
    return { marked: r.rows.length };
  });
}
