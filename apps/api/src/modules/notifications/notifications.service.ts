import { type Db, type Queryable, withTx } from '../../platform/db.js';
import type { RequestContext } from '../../platform/context.js';
import { notFound } from '../../platform/errors.js';

interface EventRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, any>;
  occurred_at: Date;
}

interface Planned {
  userIds: string[];
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: string;
  link: string | null;
  projectId: string | null;
}

async function holdersOfPosition(db: Queryable, positionId: string | null | undefined): Promise<string[]> {
  if (!positionId) return [];
  const r = await db.query<{ user_id: string }>(`SELECT DISTINCT user_id FROM v_current_position_holders WHERE position_id = $1`, [positionId]);
  return r.rows.map((x) => x.user_id);
}

async function projectOwners(db: Queryable, projectId: string): Promise<string[]> {
  const r = await db.query<{ user_id: string }>(
    `SELECT user_id FROM project_members WHERE project_id = $1 AND member_type = 'PROJECT_OWNER' AND user_id IS NOT NULL`,
    [projectId],
  );
  return r.rows.map((x) => x.user_id);
}

async function usersWithPermission(db: Queryable, permission: string): Promise<string[]> {
  const r = await db.query<{ id: string }>(
    `SELECT DISTINCT u.id FROM app_users u
       JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.is_active
       JOIN role_permissions rp ON rp.role_id = ura.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = $1 AND u.status = 'ACTIVE'`,
    [permission],
  );
  return r.rows.map((x) => x.id);
}

/** Map a domain event to user-facing notifications. Unknown event types produce none (they are still marked published). */
async function plan(db: Queryable, e: EventRow): Promise<Planned[]> {
  const p = e.payload;
  const projectId = e.aggregate_id;
  const code = (p.projectCode as string | undefined) ?? '';
  switch (e.event_type) {
    case 'TaskAssigned': {
      const users = p.userId ? [p.userId as string] : await holdersOfPosition(db, p.positionId);
      return [{ userIds: users, title: `New task: ${p.title}`, body: `${code} - assigned to your position.`, severity: 'INFO', type: 'TASK_ASSIGNED', link: p.link ?? null, projectId }];
    }
    case 'ApprovalSubmitted':
      return [{
        userIds: await holdersOfPosition(db, p.approverPositionId), title: `Approval awaiting your decision: ${String(p.approvalType).replace(/_/g, ' ')}`,
        body: `${code} was submitted for your decision.`, severity: 'WARNING', type: 'APPROVAL_SUBMITTED', link: `/approvals/${p.approvalCaseId}`, projectId,
      }];
    case 'ApprovalDecided': {
      const owners = await projectOwners(db, projectId);
      const users = [...new Set([...(p.submittedBy ? [p.submittedBy as string] : []), ...owners])];
      const negative = p.decision !== 'APPROVE';
      return [{
        userIds: users, title: `${String(p.approvalType).replace(/_/g, ' ')}: ${String(p.decision).replace(/_/g, ' ').toLowerCase()}`,
        body: `${code}${p.reason ? ` - ${p.reason}` : ''}`, severity: negative ? 'WARNING' : 'INFO', type: 'APPROVAL_DECIDED', link: `/approvals/${p.approvalCaseId}`, projectId,
      }];
    }
    case 'AuthorityUnresolved':
      return [{
        userIds: await usersWithPermission(db, 'authority.manual_assign'), title: 'Manual authority review required',
        body: `${code}: no verified competent authority could be resolved for ${String(p.approvalType).replace(/_/g, ' ')}. No automatic assignment was made.`,
        severity: 'CRITICAL', type: 'AUTHORITY_UNRESOLVED', link: `/approvals/${p.approvalCaseId}`, projectId,
      }];
    case 'ProjectSubmitted':
      return [{ userIds: await projectOwners(db, projectId), title: 'Workflow generated', body: `${code}: ${p.nodeCount} steps were generated from the configured template and verified rules.`, severity: 'INFO', type: 'WORKFLOW_GENERATED', link: `/projects/${projectId}?tab=workflow`, projectId }];
    case 'TaskOverdue':
      return [{
        userIds: [...new Set([...(p.userId ? [p.userId as string] : []), ...(await holdersOfPosition(db, p.positionId)), ...(await usersWithPermission(db, 'audit.read'))])],
        title: `Overdue against configured SLA: ${p.title}`, body: `${code}`, severity: 'WARNING', type: 'TASK_OVERDUE', link: p.link ?? null, projectId,
      }];
    case 'IssueRaised':
      return [{
        userIds: [...new Set([...(await holdersOfPosition(db, p.ownerPositionId)), ...(await projectOwners(db, projectId))])],
        title: `Issue raised: ${p.title}`, body: `${code} - ${p.severity} ${p.category}${p.blocksNodes?.length ? ` - blocks ${p.blocksNodes.join(', ')}` : ''}`,
        severity: p.severity === 'CRITICAL' || p.severity === 'HIGH' ? 'CRITICAL' : 'WARNING', type: 'ISSUE_RAISED', link: `/projects/${projectId}?tab=issues`, projectId,
      }];
    case 'InspectionCompleted':
      return [{
        userIds: await projectOwners(db, projectId), title: `Inspection ${String(p.result).toLowerCase()}`, body: `${code} - ${p.milestone ?? 'inspection'}`,
        severity: p.result === 'FAIL' ? 'WARNING' : 'INFO', type: 'INSPECTION_COMPLETED', link: `/projects/${projectId}?tab=inspections`, projectId,
      }];
    default:
      return [];
  }
}

/** Claim a batch of unpublished events (SKIP LOCKED), fan out notifications, mark them published. One savepoint per event. */
export async function dispatchPending(db: Db, batch = 50, now: Date = new Date()): Promise<{ processed: number; created: number }> {
  return withTx(db, async (tx) => {
    const events = await tx.query<EventRow>(
      `SELECT id, aggregate_id, event_type, payload, occurred_at FROM domain_events
        WHERE published_at IS NULL ORDER BY occurred_at, id FOR UPDATE SKIP LOCKED LIMIT $1`,
      [batch],
    );
    let created = 0;
    for (const e of events.rows) {
      await tx.query('SAVEPOINT ev');
      try {
        for (const n of await plan(tx, e)) {
          const users = [...new Set(n.userIds)];
          if (!users.length) continue;
          const nid = (
            await tx.query<{ id: string }>(
              `INSERT INTO notifications (event_id, project_id, notification_type, title, body, severity, link, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
              [e.id, n.projectId, n.type, n.title, n.body, n.severity, n.link, e.occurred_at],
            )
          ).rows[0]!.id;
          for (const u of users) {
            await tx.query(`INSERT INTO notification_recipients (notification_id, user_id, delivered_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [nid, u, now]);
          }
          created++;
        }
        await tx.query(`UPDATE domain_events SET published_at = $2, publication_attempts = publication_attempts + 1 WHERE id = $1`, [e.id, now]);
        await tx.query('RELEASE SAVEPOINT ev');
      } catch {
        await tx.query('ROLLBACK TO SAVEPOINT ev');
        await tx.query(`UPDATE domain_events SET publication_attempts = publication_attempts + 1 WHERE id = $1`, [e.id]);
        await tx.query('RELEASE SAVEPOINT ev');
      }
    }
    return { processed: events.rows.length, created };
  });
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: string;
  link: string | null;
  projectId: string | null;
  createdAt: string;
  read: boolean;
}

export async function listNotifications(db: Queryable, ctx: RequestContext, unreadOnly = false): Promise<{ items: NotificationDto[]; unread: number }> {
  const uid = ctx.actor!.userId;
  const rows = await db.query(
    `SELECT n.id, n.notification_type, n.title, n.body, n.severity, n.link, n.project_id, n.created_at, (nr.read_at IS NOT NULL) AS read
       FROM notification_recipients nr JOIN notifications n ON n.id = nr.notification_id
      WHERE nr.user_id = $1 AND ($2::boolean = FALSE OR nr.read_at IS NULL)
      ORDER BY n.created_at DESC, n.id LIMIT 50`,
    [uid, unreadOnly],
  );
  const unread = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM notification_recipients WHERE user_id = $1 AND read_at IS NULL`, [uid]);
  return {
    unread: unread.rows[0]!.c,
    items: rows.rows.map((r) => ({
      id: r.id, type: r.notification_type, title: r.title, body: r.body, severity: r.severity, link: r.link, projectId: r.project_id,
      createdAt: r.created_at.toISOString(), read: r.read,
    })),
  };
}

export async function markRead(db: Queryable, ctx: RequestContext, id: string | 'all'): Promise<{ updated: number }> {
  const uid = ctx.actor!.userId;
  const r =
    id === 'all'
      ? await db.query(`UPDATE notification_recipients SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL`, [uid, ctx.now])
      : await db.query(`UPDATE notification_recipients SET read_at = $3 WHERE user_id = $1 AND notification_id = $2 AND read_at IS NULL`, [uid, id, ctx.now]);
  if (id !== 'all' && !r.rowCount) {
    const exists = await db.query(`SELECT 1 FROM notification_recipients WHERE user_id = $1 AND notification_id = $2`, [uid, id]);
    if (!exists.rowCount) throw notFound('Notification');
  }
  return { updated: r.rowCount ?? 0 };
}
