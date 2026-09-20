import type { Queryable } from '../../platform/db.js';
import type { RequestContext } from '../../platform/context.js';
import { emit } from '../../platform/events.js';
import { type TaskInsert, insertTask } from './workflows.repo.js';

export interface TaskInput extends Omit<TaskInsert, 'at'> {
  projectCode: string;
  link?: string;
}

/** Insert a task and publish TaskAssigned (the notification dispatcher resolves the current holder of the seat). */
export async function createTask(tx: Queryable, ctx: RequestContext, t: TaskInput): Promise<string> {
  const id = await insertTask(tx, { ...t, at: ctx.now });
  await emit(tx, ctx, {
    aggregateType: 'PROJECT',
    aggregateId: t.projectId,
    eventType: 'TaskAssigned',
    payload: {
      taskId: id,
      taskType: t.taskType,
      title: t.title,
      projectId: t.projectId,
      projectCode: t.projectCode,
      positionId: t.assignedPositionId ?? null,
      userId: t.assignedUserId ?? null,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      link: t.link ?? `/projects/${t.projectId}`,
    },
  });
  return id;
}
