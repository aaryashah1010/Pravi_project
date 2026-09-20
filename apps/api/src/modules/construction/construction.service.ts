import type { MilestoneDto } from '@infraflow/shared';
import { type Db, type Queryable, withTx } from '../../platform/db.js';
import type { Actor, RequestContext } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { conflict, notFound, validation } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import * as wfRepo from '../workflows/workflows.repo.js';
import { completeNode } from '../workflows/workflows.service.js';

interface MilestoneRow {
  id: string;
  project_id: string;
  code: string;
  name: string;
  sequence_no: number | null;
  status: string;
  planned_start: string | null;
  planned_finish: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  planned_progress: string;
  reported_progress: string;
  verified_progress: string;
  node_code: string | null;
  node_activation: string | null;
  last_at: Date | null;
  last_by: string | null;
  last_narrative: string | null;
  last_reported: string | null;
  insp_total: number;
  insp_pass: number;
  insp_fail: number;
  insp_pending: number;
  insp_obs: number;
  blocking_issues: number;
}

const MILESTONE_SELECT = `
  SELECT m.id, m.project_id, m.code, m.name, m.sequence_no, m.status, m.planned_start, m.planned_finish, m.actual_start, m.actual_finish,
         m.planned_progress::text, m.reported_progress::text, m.verified_progress::text,
         n.node_code, n.activation_state AS node_activation,
         lu.reported_at AS last_at, u.display_name AS last_by, lu.narrative AS last_narrative, lu.reported_progress::text AS last_reported,
         (SELECT count(*)::int FROM inspections i WHERE i.milestone_id = m.id) AS insp_total,
         (SELECT count(*)::int FROM inspections i WHERE i.milestone_id = m.id AND i.result = 'PASS') AS insp_pass,
         (SELECT count(*)::int FROM inspections i WHERE i.milestone_id = m.id AND i.result = 'FAIL') AS insp_fail,
         (SELECT count(*)::int FROM inspections i WHERE i.milestone_id = m.id AND i.result = 'PENDING') AS insp_pending,
         (SELECT count(*)::int FROM inspections i WHERE i.milestone_id = m.id AND i.result = 'OBSERVATION') AS insp_obs,
         (SELECT count(DISTINCT iss.id)::int FROM issues iss JOIN issue_milestone_links iml ON iml.issue_id = iss.id AND iml.impact_type = 'BLOCKS'
           WHERE iml.milestone_id = m.id AND iss.status IN ('OPEN','IN_PROGRESS','BLOCKED')) AS blocking_issues
    FROM milestones m
    LEFT JOIN LATERAL (
      SELECT wn.node_code, wn.activation_state FROM workflow_node_instances wn
        JOIN workflow_node_templates nt ON nt.id = wn.node_template_id
        JOIN workflow_instances wi ON wi.id = wn.workflow_instance_id
       WHERE wi.project_id = m.project_id AND nt.config->>'milestone_code' = m.code LIMIT 1
    ) n ON TRUE
    LEFT JOIN LATERAL (
      SELECT mu.reported_at, mu.narrative, mu.reported_progress, mu.reported_by FROM milestone_updates mu
       WHERE mu.milestone_id = m.id ORDER BY mu.reported_at DESC, mu.id DESC LIMIT 1
    ) lu ON TRUE
    LEFT JOIN app_users u ON u.id = lu.reported_by`;

const toDto = (r: MilestoneRow): MilestoneDto => ({
  id: r.id,
  projectId: r.project_id,
  code: r.code,
  name: r.name,
  sequenceNo: r.sequence_no,
  status: r.status,
  plannedStart: r.planned_start,
  plannedFinish: r.planned_finish,
  actualStart: r.actual_start,
  actualFinish: r.actual_finish,
  plannedProgress: Number(r.planned_progress),
  reportedProgress: Number(r.reported_progress),
  verifiedProgress: Number(r.verified_progress),
  variance: Math.round((Number(r.verified_progress) - Number(r.planned_progress)) * 10) / 10,
  lastUpdate: r.last_at ? { at: r.last_at.toISOString(), by: r.last_by ?? 'Unknown', narrative: r.last_narrative, reportedProgress: Number(r.last_reported) } : null,
  inspectionCounts: { total: r.insp_total, pass: r.insp_pass, fail: r.insp_fail, pending: r.insp_pending, observation: r.insp_obs },
  openBlockingIssues: r.blocking_issues,
  nodeCode: r.node_code,
});

export async function listMilestones(db: Queryable, actor: Actor, projectId: string): Promise<MilestoneDto[]> {
  if (!(await projects.getProject(db, projectId, actor))) throw notFound('Project');
  const r = await db.query<MilestoneRow>(`${MILESTONE_SELECT} WHERE m.project_id = $1 ORDER BY m.sequence_no NULLS LAST, m.code`, [projectId]);
  return r.rows.map(toDto);
}

export async function getMilestoneRow(db: Queryable, id: string): Promise<MilestoneRow | null> {
  const r = await db.query<MilestoneRow>(`${MILESTONE_SELECT} WHERE m.id = $1`, [id]);
  return r.rows[0] ?? null;
}

/**
 * Contractor/technical progress REPORT. Reported progress is never treated as verified and can never complete a milestone;
 * only an inspector-verified 100% plus a passing inspection can (see tryCompleteMilestone).
 */
export async function reportProgress(db: Db, ctx: RequestContext, milestoneId: string, input: { reportedProgress: number; narrative?: string }): Promise<MilestoneDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const pre = await getMilestoneRow(tx, milestoneId);
    if (!pre || !(await projects.getProject(tx, pre.project_id, actor))) throw notFound('Milestone');
    await projects.lockProject(tx, pre.project_id);
    const m = (await getMilestoneRow(tx, milestoneId))!;
    if (m.status === 'COMPLETED' || m.status === 'CANCELLED') throw conflict(`This milestone is already ${m.status.toLowerCase()}.`);
    if (!m.node_activation || !['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(m.node_activation)) {
      throw conflict('Work on this milestone has not started: its predecessor steps are not complete.');
    }
    const day = ctx.now.toISOString().slice(0, 10);
    await tx.query(
      `INSERT INTO milestone_updates (milestone_id, reported_by, reported_at, reported_progress, narrative) VALUES ($1,$2,$3,$4,$5)`,
      [milestoneId, actor.userId, ctx.now, input.reportedProgress, input.narrative ?? null],
    );
    await tx.query(
      `UPDATE milestones SET reported_progress = $2, actual_start = COALESCE(actual_start, $3::date),
              status = CASE WHEN status = 'PENDING' THEN 'IN_PROGRESS' ELSE status END, updated_at = $4 WHERE id = $1`,
      [milestoneId, input.reportedProgress, day, ctx.now],
    );
    const node = m.node_code ? await wfRepo.getNode(tx, (await nodeId(tx, m.project_id, m.node_code))!) : null;
    if (node && node.activation_state === 'ELIGIBLE') {
      await wfRepo.updateNode(tx, node.id, { activation_state: 'ACTIVE', execution_state: 'IN_PROGRESS', started_at: ctx.now });
      await wfRepo.insertTransition(tx, {
        nodeId: node.id, fromActivation: 'ELIGIBLE', toActivation: 'ACTIVE', fromExecution: node.execution_state, toExecution: 'IN_PROGRESS',
        actorUserId: actor.userId, reason: 'WORK_STARTED', metadata: { reportedProgress: input.reportedProgress }, at: ctx.now,
      });
    }
    await audit(tx, ctx, {
      action: 'milestone.progress_reported', entityType: 'milestone', entityId: milestoneId, projectId: m.project_id,
      oldData: { reportedProgress: Number(m.reported_progress) }, newData: { reportedProgress: input.reportedProgress }, metadata: { code: m.code, narrative: input.narrative ?? null },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: m.project_id, eventType: 'MilestoneUpdated',
      payload: { milestoneId, code: m.code, name: m.name, reportedProgress: input.reportedProgress, verifiedProgress: Number(m.verified_progress) },
    });
  });
  return toDto((await getMilestoneRow(db, milestoneId))!);
}

async function nodeId(db: Queryable, projectId: string, nodeCode: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `SELECT n.id FROM workflow_node_instances n JOIN workflow_instances wi ON wi.id = n.workflow_instance_id WHERE wi.project_id = $1 AND n.node_code = $2`,
    [projectId, nodeCode],
  );
  return r.rows[0]?.id ?? null;
}

export async function planMilestone(
  db: Db,
  ctx: RequestContext,
  milestoneId: string,
  plan: { plannedStart?: string; plannedFinish?: string; plannedProgress?: number },
): Promise<MilestoneDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const m = await getMilestoneRow(tx, milestoneId);
    if (!m || !(await projects.getProject(tx, m.project_id, actor))) throw notFound('Milestone');
    const start = plan.plannedStart ?? m.planned_start;
    const finish = plan.plannedFinish ?? m.planned_finish;
    if (start && finish && finish < start) throw validation('Planned finish cannot be before planned start.', [{ field: 'plannedFinish', message: 'Before start' }]);
    await tx.query(
      `UPDATE milestones SET planned_start = COALESCE($2::date, planned_start), planned_finish = COALESCE($3::date, planned_finish),
              planned_progress = COALESCE($4, planned_progress), updated_at = $5 WHERE id = $1`,
      [milestoneId, plan.plannedStart ?? null, plan.plannedFinish ?? null, plan.plannedProgress ?? null, ctx.now],
    );
    await audit(tx, ctx, { action: 'milestone.planned', entityType: 'milestone', entityId: milestoneId, projectId: m.project_id, newData: plan, metadata: { code: m.code } });
  });
  return toDto((await getMilestoneRow(db, milestoneId))!);
}

/**
 * A milestone completes only when the INSPECTOR-verified progress is 100% AND the latest inspection passed AND
 * no blocking issue is open. Completing it completes its workflow node, which unlocks downstream steps.
 */
export async function tryCompleteMilestone(tx: Queryable, ctx: RequestContext, milestoneId: string): Promise<boolean> {
  const m = await getMilestoneRow(tx, milestoneId);
  if (!m || m.status === 'COMPLETED' || !m.node_code) return false;
  if (Number(m.verified_progress) < 100 || m.blocking_issues > 0) return false;
  if (!m.node_activation || !['ELIGIBLE', 'ACTIVE'].includes(m.node_activation)) return false;
  const latest = await tx.query<{ result: string }>(
    `SELECT result FROM inspections WHERE milestone_id = $1 AND result <> 'PENDING' AND result <> 'CANCELLED' ORDER BY inspected_at DESC NULLS LAST, created_at DESC LIMIT 1`,
    [milestoneId],
  );
  if (latest.rows[0]?.result !== 'PASS') return false;
  await tx.query(
    `UPDATE milestones SET status = 'COMPLETED', actual_finish = $2::date, updated_at = $3 WHERE id = $1`,
    [milestoneId, ctx.now.toISOString().slice(0, 10), ctx.now],
  );
  const id = await nodeId(tx, m.project_id, m.node_code);
  if (id) await completeNode(tx, ctx, id, 'MILESTONE_VERIFIED_COMPLETE', { milestoneId, code: m.code });
  await audit(tx, ctx, { action: 'milestone.completed', entityType: 'milestone', entityId: milestoneId, projectId: m.project_id, metadata: { code: m.code, verifiedProgress: 100 } });
  return true;
}
