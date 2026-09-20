import type { CreateIssueInput, IssueDto } from '@infraflow/shared';
import { type Db, type Queryable, withTx } from '../../platform/db.js';
import type { Actor, RequestContext } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { conflict, notFound, validation } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import * as wfRepo from '../workflows/workflows.repo.js';
import { recompute } from '../workflows/workflows.service.js';

const DAY = 86_400_000;
const OPEN = ['OPEN', 'IN_PROGRESS', 'BLOCKED'];

interface IssueRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  status: string;
  opened_at: Date;
  due_at: Date | null;
  resolved_at: Date | null;
  impact: Record<string, unknown>;
  created_by_name: string | null;
  position_code: string | null;
  designation: string | null;
}

const ISSUE_SELECT = `
  SELECT i.id, i.project_id, i.title, i.description, i.category, i.severity, i.status, i.opened_at, i.due_at, i.resolved_at, i.impact,
         u.display_name AS created_by_name, pos.position_code, pt.designation
    FROM issues i
    LEFT JOIN app_users u ON u.id = i.created_by
    LEFT JOIN positions pos ON pos.id = i.owner_position_id
    LEFT JOIN position_types pt ON pt.id = pos.position_type_id`;

async function toDtos(db: Queryable, rows: IssueRow[], now: Date): Promise<IssueDto[]> {
  if (!rows.length) return [];
  const links = await db.query<{ issue_id: string; node_code: string; name: string; impact_type: string }>(
    `SELECT iwl.issue_id, n.node_code, nt.name, iwl.impact_type
       FROM issue_workflow_links iwl
       JOIN workflow_node_instances n ON n.id = iwl.workflow_node_instance_id
       JOIN workflow_node_templates nt ON nt.id = n.node_template_id
      WHERE iwl.issue_id = ANY($1::uuid[]) ORDER BY n.node_code`,
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => {
    const mine = links.rows.filter((l) => l.issue_id === r.id);
    const open = OPEN.includes(r.status);
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      description: r.description,
      category: r.category,
      severity: r.severity,
      status: r.status,
      openedAt: r.opened_at.toISOString(),
      dueAt: r.due_at?.toISOString() ?? null,
      resolvedAt: r.resolved_at?.toISOString() ?? null,
      ageDays: Math.max(0, Math.floor(((r.resolved_at ?? now).getTime() - r.opened_at.getTime()) / DAY)),
      overdue: open && !!r.due_at && r.due_at.getTime() < now.getTime(),
      createdBy: r.created_by_name,
      owner: r.position_code ? { positionCode: r.position_code, designation: r.designation! } : null,
      blocks: mine.filter((l) => l.impact_type === 'BLOCKS').map((l) => ({ nodeCode: l.node_code, name: l.name })),
      affects: mine.filter((l) => l.impact_type === 'AFFECTS').map((l) => ({ nodeCode: l.node_code, name: l.name })),
      resolution: (r.impact?.resolution as string | undefined) ?? null,
    };
  });
}

export async function listIssues(db: Queryable, actor: Actor, projectId: string, now: Date, status: 'open' | 'all' = 'all'): Promise<IssueDto[]> {
  if (!(await projects.getProject(db, projectId, actor))) throw notFound('Project');
  const r = await db.query<IssueRow>(
    `${ISSUE_SELECT} WHERE i.project_id = $1 AND ($2 = 'all' OR i.status = ANY($3::text[])) ORDER BY i.opened_at DESC`,
    [projectId, status, OPEN],
  );
  return toDtos(db, r.rows, now);
}

export async function getIssue(db: Queryable, actor: Actor, id: string, now: Date): Promise<IssueDto> {
  const r = await db.query<IssueRow>(`${ISSUE_SELECT} WHERE i.id = $1`, [id]);
  const row = r.rows[0];
  if (!row || !(await projects.getProject(db, row.project_id, actor))) throw notFound('Issue');
  return (await toDtos(db, [row], now))[0]!;
}

/** Transaction-level creation (also used when a failed inspection raises an issue). Caller has authorised access. */
export async function createIssueTx(
  tx: Queryable,
  ctx: RequestContext,
  project: projects.ProjectRow,
  input: CreateIssueInput & { milestoneId?: string | null },
): Promise<string> {
  const instance = await wfRepo.getInstance(tx, project.id);
  const codes = [...new Set([...input.blocksNodes, ...input.affectsNodes])];
  if (codes.length && !instance) throw validation('The project has no workflow yet, so issues cannot be linked to workflow steps.');
  const nodes = instance ? await wfRepo.loadNodes(tx, instance.id) : [];
  const unknown = codes.filter((c) => !nodes.some((n) => n.node_code === c));
  if (unknown.length) throw validation('Unknown workflow step.', unknown.map((c) => ({ field: 'blocksNodes', message: `Unknown step: ${c}` })));
  const target = nodes.filter((n) => input.blocksNodes.includes(n.node_code));
  const done = target.filter((n) => n.activation_state === 'COMPLETED' || n.activation_state === 'NOT_APPLICABLE');
  if (done.length) throw validation('A completed or not-applicable step cannot be blocked.', done.map((n) => ({ field: 'blocksNodes', message: `${n.node_code} is ${n.activation_state}` })));

  const milestoneNode = nodes.find((n) => n.node_type === 'MILESTONE' && codes.includes(n.node_code));
  let milestoneId = input.milestoneId ?? null;
  if (!milestoneId && milestoneNode) {
    const m = await tx.query<{ id: string }>(`SELECT id FROM milestones WHERE project_id = $1 AND code = $2`, [project.id, String(milestoneNode.config.milestone_code ?? '')]);
    milestoneId = m.rows[0]?.id ?? null;
  }

  const r = await tx.query<{ id: string }>(
    `INSERT INTO issues (project_id, milestone_id, category, title, description, severity, status, owner_position_id, opened_at, due_at, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7,$8,$9,$10,$8,$8) RETURNING id`,
    [project.id, milestoneId, input.category, input.title, input.description ?? null, input.severity, input.ownerPositionId ?? null, ctx.now, input.dueAt ?? null, ctx.actor?.userId ?? null],
  );
  const id = r.rows[0]!.id;
  for (const n of nodes.filter((x) => codes.includes(x.node_code))) {
    const impact = input.blocksNodes.includes(n.node_code) ? 'BLOCKS' : 'AFFECTS';
    await tx.query(`INSERT INTO issue_workflow_links (issue_id, workflow_node_instance_id, impact_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [id, n.id, impact]);
  }
  if (milestoneId) await tx.query(`INSERT INTO issue_milestone_links (issue_id, milestone_id, impact_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [id, milestoneId, input.blocksNodes.length ? 'BLOCKS' : 'AFFECTS']);

  await audit(tx, ctx, {
    action: 'issue.raised', entityType: 'issue', entityId: id, projectId: project.id,
    newData: { title: input.title, category: input.category, severity: input.severity, blocks: input.blocksNodes, affects: input.affectsNodes },
  });
  await emit(tx, ctx, {
    aggregateType: 'PROJECT', aggregateId: project.id, eventType: 'IssueRaised',
    payload: { issueId: id, title: input.title, severity: input.severity, category: input.category, blocksNodes: input.blocksNodes, ownerPositionId: input.ownerPositionId ?? null, projectCode: project.project_code },
  });
  if (input.blocksNodes.length) await recompute(tx, ctx, project.id);
  return id;
}

export async function createIssue(db: Db, ctx: RequestContext, projectId: string, input: CreateIssueInput): Promise<IssueDto> {
  const actor = ctx.actor!;
  const id = await withTx(db, async (tx) => {
    const project = await projects.getProject(tx, projectId, actor);
    if (!project) throw notFound('Project');
    await projects.lockProject(tx, projectId);
    return createIssueTx(tx, ctx, project, input);
  });
  return getIssue(db, actor, id, ctx.now);
}

export async function resolveIssue(db: Db, ctx: RequestContext, id: string, resolution: string): Promise<IssueDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const pre = (await tx.query<IssueRow>(`${ISSUE_SELECT} WHERE i.id = $1`, [id])).rows[0];
    if (!pre || !(await projects.getProject(tx, pre.project_id, actor))) throw notFound('Issue');
    await projects.lockProject(tx, pre.project_id);
    const locked = (await tx.query<{ status: string }>(`SELECT status FROM issues WHERE id = $1 FOR UPDATE`, [id])).rows[0]!;
    if (!OPEN.includes(locked.status)) throw conflict(`This issue is already ${locked.status.toLowerCase()}.`);
    await tx.query(
      `UPDATE issues SET status = 'RESOLVED', resolved_at = $2, updated_at = $2,
              impact = impact || $3::jsonb WHERE id = $1`,
      [id, ctx.now, JSON.stringify({ resolution, resolvedBy: actor.displayName, resolvedByUserId: actor.userId })],
    );
    await audit(tx, ctx, { action: 'issue.resolved', entityType: 'issue', entityId: id, projectId: pre.project_id, oldData: { status: locked.status }, newData: { status: 'RESOLVED' }, metadata: { resolution } });
    await emit(tx, ctx, { aggregateType: 'PROJECT', aggregateId: pre.project_id, eventType: 'IssueResolved', payload: { issueId: id, title: pre.title, resolution } });
    await recompute(tx, ctx, pre.project_id);
  });
  return getIssue(db, actor, id, ctx.now);
}
