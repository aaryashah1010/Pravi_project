import type { AttentionItemDto, DashboardSummaryDto, OverdueItemDto } from '@infraflow/shared';
import type { Queryable } from '../../platform/db.js';
import type { RequestContext } from '../../platform/context.js';
import { scopeClause, listProjects } from '../projects/projects.repo.js';
import { toSummary } from '../projects/projects.service.js';
import { getWorkflow } from '../workflows/workflow-view.js';
import { getProjectBlockers } from '../workflows/blockers.service.js';

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export async function summary(db: Queryable, ctx: RequestContext): Promise<DashboardSummaryDto> {
  const actor = ctx.actor!;
  const params: unknown[] = [];
  const scope = scopeClause(actor, 'p', params);
  const now = ctx.now;
  params.push(now);
  const nowIdx = params.length;

  const [proj, appr, byType, tasks, issues, fin, prog] = await Promise.all([
    db.query(
      `SELECT count(*) FILTER (WHERE p.operational_status IN ('ACTIVE','AT_RISK','BLOCKED'))::int AS active,
              COALESCE(sum(p.estimated_cost) FILTER (WHERE p.operational_status IN ('ACTIVE','AT_RISK','BLOCKED')), 0)::text AS total_value,
              count(*) FILTER (WHERE p.operational_status = 'ACTIVE')::int AS on_track,
              count(*) FILTER (WHERE p.operational_status = 'AT_RISK')::int AS at_risk,
              count(*) FILTER (WHERE p.operational_status = 'BLOCKED')::int AS blocked,
              count(*) FILTER (WHERE p.operational_status IN ('COMPLETED','CLOSED'))::int AS completed
         FROM projects p WHERE ${scope}`,
      params.slice(0, nowIdx - 1),
    ),
    db.query(
      `SELECT count(*)::int AS pending,
              COALESCE(avg(EXTRACT(EPOCH FROM ($${nowIdx}::timestamptz - COALESCE(ac.submitted_at, n.eligible_at, ac.created_at))) / 86400), 0)::float AS avg_age,
              count(*) FILTER (WHERE n.due_at IS NOT NULL AND n.due_at < $${nowIdx}::timestamptz)::int AS overdue
         FROM approval_cases ac JOIN projects p ON p.id = ac.project_id JOIN workflow_node_instances n ON n.id = ac.workflow_node_instance_id
        WHERE ac.status IN ('PENDING','IN_REVIEW','RETURNED') AND ${scope}`,
      params,
    ),
    db.query(
      `SELECT ac.approval_type AS type, count(*)::int AS count FROM approval_cases ac JOIN projects p ON p.id = ac.project_id
        WHERE ac.status IN ('PENDING','IN_REVIEW','RETURNED') AND ${scope} GROUP BY 1 ORDER BY 2 DESC, 1`,
      params.slice(0, nowIdx - 1),
    ),
    db.query(
      `SELECT count(*)::int AS open, count(*) FILTER (WHERE t.due_at IS NOT NULL AND t.due_at < $${nowIdx}::timestamptz)::int AS overdue
         FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.status IN ('PENDING','IN_PROGRESS','OVERDUE','BLOCKED') AND ${scope}`,
      params,
    ),
    db.query(
      `SELECT count(*)::int AS open, count(*) FILTER (WHERE i.severity IN ('HIGH','CRITICAL'))::int AS critical
         FROM issues i JOIN projects p ON p.id = i.project_id WHERE i.status IN ('OPEN','IN_PROGRESS','BLOCKED') AND ${scope}`,
      params.slice(0, nowIdx - 1),
    ),
    db.query(
      `SELECT COALESCE((SELECT sum(p2.estimated_cost) FROM projects p2 WHERE p2.id IN (SELECT p.id FROM projects p WHERE ${scope})), 0)::text AS est,
              COALESCE((SELECT sum(s.sanctioned_amount) FROM sanctions s JOIN projects p ON p.id = s.project_id WHERE s.sanction_type = 'TECHNICAL_SANCTION' AND ${scope}), 0)::text AS sanctioned`,
      params.slice(0, nowIdx - 1),
    ),
    db.query(
      `SELECT count(*)::int AS n, COALESCE(avg(m.planned_progress), 0)::float AS planned, COALESCE(avg(m.verified_progress), 0)::float AS verified,
              COALESCE(avg(m.reported_progress), 0)::float AS reported
         FROM milestones m JOIN projects p ON p.id = m.project_id WHERE m.status <> 'CANCELLED' AND ${scope}`,
      params.slice(0, nowIdx - 1),
    ),
  ]);

  // Downstream steps currently prevented by flagged blockers (deterministic, from the graph).
  const attn = await attention(db, ctx, 50);
  const blockedDownstream = attn.reduce((s, a) => s + a.blocker.downstreamCount, 0);

  return {
    generatedAt: now.toISOString(),
    projects: { active: proj.rows[0].active, totalValue: proj.rows[0].total_value, onTrack: proj.rows[0].on_track, atRisk: proj.rows[0].at_risk, blocked: proj.rows[0].blocked, completed: proj.rows[0].completed },
    approvals: { pending: appr.rows[0].pending, avgAgeDays: round1(appr.rows[0].avg_age), overdue: appr.rows[0].overdue, byType: byType.rows },
    tasks: { open: tasks.rows[0].open, overdue: tasks.rows[0].overdue },
    issues: { open: issues.rows[0].open, critical: issues.rows[0].critical },
    blockedDownstream,
    financial: { totalEstimated: fin.rows[0].est, totalSanctioned: fin.rows[0].sanctioned },
    progress: { plannedAvg: round1(prog.rows[0].planned), verifiedAvg: round1(prog.rows[0].verified), reportedAvg: round1(prog.rows[0].reported), milestones: prog.rows[0].n },
  };
}

/** One entry per project that has at least one flagged root blocker; most impactful first. */
export async function attention(db: Queryable, ctx: RequestContext, limit = 5): Promise<AttentionItemDto[]> {
  const actor = ctx.actor!;
  const projects = (await listProjects(db, actor, { limit: 100 })).filter((p) => p.has_workflow && ['ACTIVE', 'AT_RISK', 'BLOCKED'].includes(p.operational_status));
  const out: AttentionItemDto[] = [];
  for (const p of projects) {
    const wf = await getWorkflow(db, actor, p.id, ctx.now);
    const b = await getProjectBlockers(db, actor, p.id, ctx.now, wf);
    if (b.blockers.length) out.push({ project: toSummary(p), blocker: b.blockers[0]!, blockerCount: b.blockers.length });
  }
  const weight = (i: AttentionItemDto) => (i.blocker.reason === 'APPROVAL_REJECTED' ? 3 : i.blocker.reason === 'ISSUE_BLOCKS' ? 2 : 1);
  return out
    .sort((a, b) => weight(b) - weight(a) || b.blocker.downstreamCount - a.blocker.downstreamCount || b.blocker.ageDays - a.blocker.ageDays || a.project.code.localeCompare(b.project.code))
    .slice(0, limit);
}

/** SLA watch: live workflow steps past their configured due date, across the actor's visible projects. */
export async function overdue(db: Queryable, ctx: RequestContext, limit = 20): Promise<OverdueItemDto[]> {
  const params: unknown[] = [];
  const scope = scopeClause(ctx.actor!, 'p', params);
  params.push(ctx.now, limit);
  const r = await db.query(
    `SELECT p.id AS project_id, p.project_code, p.name AS project_name, n.node_code, nt.name AS node_name, n.eligible_at, n.due_at, n.sla_days,
            pt.designation, h.display_name AS holder
       FROM workflow_node_instances n
       JOIN workflow_node_templates nt ON nt.id = n.node_template_id
       JOIN workflow_instances wi ON wi.id = n.workflow_instance_id
       JOIN projects p ON p.id = wi.project_id
       LEFT JOIN positions pos ON pos.id = n.assigned_position_id
       LEFT JOIN position_types pt ON pt.id = pos.position_type_id
       LEFT JOIN v_current_position_holders h ON h.position_id = pos.id AND h.assignment_type = 'PRIMARY'
      WHERE n.activation_state IN ('ELIGIBLE','ACTIVE','BLOCKED') AND n.due_at IS NOT NULL AND n.due_at < $${params.length - 1}::timestamptz
        AND p.operational_status IN ('ACTIVE','AT_RISK','BLOCKED') AND ${scope}
      ORDER BY n.due_at LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((x) => ({
    projectId: x.project_id,
    projectCode: x.project_code,
    projectName: x.project_name,
    nodeCode: x.node_code,
    nodeName: x.node_name,
    ageDays: x.eligible_at ? Math.floor((ctx.now.getTime() - x.eligible_at.getTime()) / DAY) : 0,
    overdueDays: Math.floor((ctx.now.getTime() - x.due_at.getTime()) / DAY),
    slaDays: x.sla_days,
    ownerDesignation: x.designation,
    ownerHolder: x.holder,
  }));
}
