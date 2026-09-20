import { type Db, type Queryable, withTx } from '../../platform/db.js';
import { type Actor, type RequestContext, can } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { conflict, forbidden, notFound, validation } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import * as wfRepo from '../workflows/workflows.repo.js';
import { completeNode } from '../workflows/workflows.service.js';

const DAY = 86_400_000;
const OPEN = ['PENDING', 'IN_PROGRESS', 'OVERDUE', 'BLOCKED'];

export interface TaskDto {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  nodeCode: string | null;
  taskType: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  overdue: boolean;
  ageDays: number;
  versionNo: number;
  assignedPosition: { code: string; designation: string; officeName: string } | null;
  viaSeat: boolean;
  /** The assigned seat currently has no holder; only administrators are shown such tasks. */
  vacantSeat: boolean;
  canComplete: boolean;
}

interface TaskRow {
  id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  workflow_node_instance_id: string | null;
  node_code: string | null;
  task_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_at: Date | null;
  created_at: Date;
  version_no: number;
  assigned_user_id: string | null;
  assigned_position_id: string | null;
  position_code: string | null;
  designation: string | null;
  office_name: string | null;
  seat_vacant: boolean;
}

const TASK_SELECT = `
  SELECT t.id, t.project_id, p.project_code, p.name AS project_name, t.workflow_node_instance_id, n.node_code, t.task_type, t.title,
         t.description, t.priority, t.status, t.due_at, t.created_at, t.version_no, t.assigned_user_id, t.assigned_position_id,
         pos.position_code, pt.designation, o.name AS office_name,
         (t.assigned_position_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM v_current_position_holders h WHERE h.position_id = t.assigned_position_id)) AS seat_vacant
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN workflow_node_instances n ON n.id = t.workflow_node_instance_id
    LEFT JOIN positions pos ON pos.id = t.assigned_position_id
    LEFT JOIN position_types pt ON pt.id = pos.position_type_id
    LEFT JOIN offices o ON o.id = pos.office_id`;

function isMine(actor: Actor, t: Pick<TaskRow, 'assigned_user_id' | 'assigned_position_id'>): boolean {
  return t.assigned_user_id === actor.userId || (!!t.assigned_position_id && actor.positions.some((p) => p.positionId === t.assigned_position_id));
}

function toDto(actor: Actor, t: TaskRow, now: Date): TaskDto {
  const open = OPEN.includes(t.status);
  return {
    id: t.id,
    projectId: t.project_id,
    projectCode: t.project_code,
    projectName: t.project_name,
    nodeCode: t.node_code,
    taskType: t.task_type,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    dueAt: t.due_at?.toISOString() ?? null,
    overdue: open && !!t.due_at && t.due_at.getTime() < now.getTime(),
    ageDays: Math.max(0, Math.floor((now.getTime() - t.created_at.getTime()) / DAY)),
    versionNo: t.version_no,
    assignedPosition: t.position_code ? { code: t.position_code, designation: t.designation!, officeName: t.office_name! } : null,
    viaSeat: !!t.assigned_position_id,
    vacantSeat: t.seat_vacant,
    canComplete: open && t.task_type === 'WORK_ITEM' && (isMine(actor, t) || can(actor, 'workflow.manage')),
  };
}

/**
 * Tasks assigned to me directly OR to a seat I currently hold (position, not person).
 * Administrators (workflow.manage) additionally see tasks parked on VACANT seats so nothing is silently orphaned.
 */
export async function listMyTasks(db: Queryable, ctx: RequestContext): Promise<TaskDto[]> {
  const actor = ctx.actor!;
  const r = await db.query<TaskRow>(
    `${TASK_SELECT}
      WHERE t.status = ANY($3::text[])
        AND (t.assigned_user_id = $1 OR t.assigned_position_id = ANY($2::uuid[])
             OR ($4::boolean AND t.assigned_position_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM v_current_position_holders h WHERE h.position_id = t.assigned_position_id)))
      ORDER BY (t.due_at IS NULL), t.due_at, t.created_at`,
    [actor.userId, actor.positions.map((p) => p.positionId), OPEN, can(actor, 'workflow.manage')],
  );
  return r.rows.map((t) => toDto(actor, t, ctx.now));
}

export async function listProjectTasks(db: Queryable, ctx: RequestContext, projectId: string): Promise<TaskDto[]> {
  const actor = ctx.actor!;
  if (!(await projects.getProject(db, projectId, actor))) throw notFound('Project');
  const r = await db.query<TaskRow>(`${TASK_SELECT} WHERE t.project_id = $1 ORDER BY t.created_at DESC LIMIT 200`, [projectId]);
  return r.rows.map((t) => toDto(actor, t, ctx.now));
}

/** Complete an ordinary work item and let the graph react. Approval/milestone tasks complete through their own actions. */
export async function completeTask(db: Db, ctx: RequestContext, taskId: string, expectedVersion?: number): Promise<TaskDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const pre = (await tx.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [taskId])).rows[0];
    if (!pre || !(await projects.getProject(tx, pre.project_id, actor))) throw notFound('Task');
    await projects.lockProject(tx, pre.project_id);
    await tx.query(`SELECT 1 FROM tasks WHERE id = $1 FOR UPDATE`, [taskId]);
    const t = (await tx.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [taskId])).rows[0]!;

    if (!OPEN.includes(t.status)) throw conflict(`This task is already ${t.status.toLowerCase()}.`);
    if (expectedVersion !== undefined && expectedVersion !== t.version_no) throw conflict('The task was changed by someone else. Reload and try again.');
    if (t.task_type !== 'WORK_ITEM' || !t.workflow_node_instance_id) {
      throw validation('This task is completed through its own action (for example submitting or deciding an approval).');
    }
    if (!isMine(actor, t) && !can(actor, 'workflow.manage')) throw forbidden('Only the holder of the assigned position can complete this task.');

    const node = (await wfRepo.getNode(tx, t.workflow_node_instance_id))!;
    const docs = await tx.query<{ code: string; name: string; status: string }>(
      `SELECT dt.code, dt.name, prd.status FROM project_required_documents prd JOIN document_types dt ON dt.id = prd.document_type_id
        WHERE prd.workflow_node_instance_id = $1 AND prd.required`,
      [node.id],
    );
    const missing = docs.rows.filter((d) => d.status === 'MISSING' || d.status === 'REJECTED');
    if (missing.length) throw validation('Required documents are missing.', missing.map((d) => ({ field: d.code, message: `${d.name} is ${d.status.toLowerCase()}` })));

    // Data-driven side effects declared on the template node (no node codes hard-coded here).
    const onComplete = (node.config.on_complete ?? {}) as { site_possession_status?: string };
    if (onComplete.site_possession_status) await projects.upsertSite(tx, t.project_id, { possessionStatus: onComplete.site_possession_status }, ctx.now);
    if (node.node_type === 'CLEARANCE') {
      await tx.query(`UPDATE clearances SET status = 'APPROVED', decision_at = $2, updated_at = $2 WHERE workflow_node_instance_id = $1`, [node.id, ctx.now]);
    }

    await completeNode(tx, ctx, node.id, 'TASK_COMPLETED', { taskId });
    await audit(tx, ctx, { action: 'task.completed', entityType: 'task', entityId: taskId, projectId: t.project_id, metadata: { nodeCode: node.node_code, title: t.title } });
    await emit(tx, ctx, { aggregateType: 'PROJECT', aggregateId: t.project_id, eventType: 'TaskCompleted', payload: { taskId, nodeCode: node.node_code, projectCode: t.project_code, title: t.title } });
  });
  const r = await db.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [taskId]);
  return toDto(actor, r.rows[0]!, ctx.now);
}
