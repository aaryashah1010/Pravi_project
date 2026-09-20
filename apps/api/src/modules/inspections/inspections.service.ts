import type { InspectionDto, SubmitInspectionInput } from '@infraflow/shared';
import { type Db, type Queryable, withTx } from '../../platform/db.js';
import { type Actor, type RequestContext, can } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { conflict, forbidden, notFound, validation } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import * as wfRepo from '../workflows/workflows.repo.js';
import { createTask } from '../workflows/task-factory.js';
import { addDays } from '../workflows/workflows.service.js';
import { actorHoldsPosition } from '../approvals/approvals.repo.js';
import { createIssueTx } from '../issues/issues.service.js';
import { getMilestoneRow, tryCompleteMilestone } from '../construction/construction.service.js';

interface InspRow {
  id: string;
  project_id: string;
  project_code: string;
  milestone_id: string | null;
  milestone_code: string | null;
  milestone_name: string | null;
  template_code: string | null;
  template_name: string | null;
  checklist_schema: { code: string; label: string }[] | null;
  result: string;
  requested_at: Date | null;
  requested_by_name: string | null;
  inspected_at: Date | null;
  inspector_position_id: string | null;
  position_code: string | null;
  designation: string | null;
  holder_name: string | null;
  observations: string | null;
  latitude: string | null;
  longitude: string | null;
}

const INSP_SELECT = `
  SELECT i.id, i.project_id, p.project_code, i.milestone_id, m.code AS milestone_code, m.name AS milestone_name,
         it.code AS template_code, it.name AS template_name, it.checklist_schema, i.result, i.requested_at, ru.display_name AS requested_by_name,
         i.inspected_at, i.inspector_position_id, pos.position_code, pt.designation, h.display_name AS holder_name,
         i.observations, i.latitude::text, i.longitude::text
    FROM inspections i
    JOIN projects p ON p.id = i.project_id
    LEFT JOIN milestones m ON m.id = i.milestone_id
    LEFT JOIN inspection_templates it ON it.id = i.inspection_template_id
    LEFT JOIN app_users ru ON ru.id = i.requested_by
    LEFT JOIN positions pos ON pos.id = i.inspector_position_id
    LEFT JOIN position_types pt ON pt.id = pos.position_type_id
    LEFT JOIN v_current_position_holders h ON h.position_id = pos.id AND h.assignment_type = 'PRIMARY'`;

async function toDtos(db: Queryable, actor: Actor, rows: InspRow[]): Promise<InspectionDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [results, evidence, meas, issues] = await Promise.all([
    db.query<{ inspection_id: string; item_code: string; item_label: string; result: string; notes: string | null }>(
      `SELECT inspection_id, item_code, item_label, result, notes FROM inspection_checklist_results WHERE inspection_id = ANY($1::uuid[]) ORDER BY item_code`,
      [ids],
    ),
    db.query(
      `SELECT e.target_id AS inspection_id, d.id AS document_id, d.title, v.mime_type, v.sha256, v.uploaded_at,
              (v.metadata->>'latitude')::float AS lat, (v.metadata->>'longitude')::float AS lon
         FROM evidence_links e
         JOIN document_versions v ON v.id = e.document_version_id
         JOIN documents d ON d.id = v.document_id
        WHERE e.target_type = 'INSPECTION' AND e.target_id = ANY($1::uuid[]) ORDER BY v.uploaded_at`,
      [ids],
    ),
    db.query<{ inspection_id: string; measurement_reference: string; measured_quantity: string; unit: string; status: string }>(
      `SELECT inspection_id, measurement_reference, measured_quantity::text, unit, status FROM measurements WHERE inspection_id = ANY($1::uuid[])`,
      [ids],
    ),
    db.query<{ inspection_id: string; issue_id: string }>(
      `SELECT (i.impact->>'inspectionId')::uuid AS inspection_id, i.id AS issue_id FROM issues i WHERE (i.impact->>'inspectionId')::uuid = ANY($1::uuid[])`,
      [ids],
    ),
  ]);
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectCode: r.project_code,
    milestoneCode: r.milestone_code,
    milestoneName: r.milestone_name,
    templateCode: r.template_code,
    templateName: r.template_name,
    checklistSchema: r.checklist_schema ?? [],
    result: r.result,
    requestedAt: r.requested_at?.toISOString() ?? null,
    requestedBy: r.requested_by_name,
    inspectedAt: r.inspected_at?.toISOString() ?? null,
    inspector: r.position_code ? { positionCode: r.position_code, designation: r.designation!, holderName: r.holder_name } : null,
    observations: r.observations,
    latitude: r.latitude,
    longitude: r.longitude,
    checklistResults: results.rows.filter((x) => x.inspection_id === r.id).map((x) => ({ itemCode: x.item_code, label: x.item_label, result: x.result, notes: x.notes })),
    evidence: evidence.rows.filter((x) => x.inspection_id === r.id).map((x) => ({
      documentId: x.document_id, title: x.title, mimeType: x.mime_type, sha256: x.sha256, uploadedAt: x.uploaded_at.toISOString(), latitude: x.lat, longitude: x.lon,
    })),
    measurements: meas.rows.filter((x) => x.inspection_id === r.id).map((x) => ({ reference: x.measurement_reference, quantity: x.measured_quantity, unit: x.unit, status: x.status })),
    canSubmit: r.result === 'PENDING' && can(actor, 'inspection.submit') && (can(actor, 'workflow.manage') || (!!r.inspector_position_id && actor.positions.some((p) => p.positionId === r.inspector_position_id))),
    raisedIssueId: issues.rows.find((x) => x.inspection_id === r.id)?.issue_id ?? null,
  }));
}

async function milestoneNodeId(db: Queryable, projectId: string, milestoneCode: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `SELECT n.id FROM workflow_node_instances n
       JOIN workflow_node_templates nt ON nt.id = n.node_template_id JOIN workflow_instances wi ON wi.id = n.workflow_instance_id
      WHERE wi.project_id = $1 AND nt.config->>'milestone_code' = $2`,
    [projectId, milestoneCode],
  );
  return r.rows[0]?.id ?? null;
}

export async function listInspections(db: Queryable, actor: Actor, projectId: string): Promise<InspectionDto[]> {
  if (!(await projects.getProject(db, projectId, actor))) throw notFound('Project');
  const r = await db.query<InspRow>(`${INSP_SELECT} WHERE i.project_id = $1 ORDER BY (i.result = 'PENDING') DESC, COALESCE(i.inspected_at, i.requested_at) DESC`, [projectId]);
  return toDtos(db, actor, r.rows);
}

export async function getInspection(db: Queryable, actor: Actor, id: string): Promise<InspectionDto> {
  const r = await db.query<InspRow>(`${INSP_SELECT} WHERE i.id = $1`, [id]);
  const row = r.rows[0];
  if (!row || !(await projects.getProject(db, row.project_id, actor))) throw notFound('Inspection');
  return (await toDtos(db, actor, [row]))[0]!;
}

export async function requestInspection(
  db: Db,
  ctx: RequestContext,
  projectId: string,
  input: { milestoneCode: string; templateCode: string; note?: string },
): Promise<InspectionDto> {
  const actor = ctx.actor!;
  const id = await withTx(db, async (tx) => {
    const project = await projects.getProject(tx, projectId, actor);
    if (!project) throw notFound('Project');
    await projects.lockProject(tx, projectId);
    const ms = (await tx.query<{ id: string; name: string; status: string }>(`SELECT id, name, status FROM milestones WHERE project_id = $1 AND code = $2`, [projectId, input.milestoneCode])).rows[0];
    if (!ms) throw validation('Unknown milestone for this project.', [{ field: 'milestoneCode', message: 'Unknown milestone' }]);
    if (ms.status === 'COMPLETED') throw conflict('This milestone is already completed.');
    const tpl = (await tx.query<{ id: string }>(`SELECT id FROM inspection_templates WHERE code = $1 AND status = 'ACTIVE'`, [input.templateCode])).rows[0];
    if (!tpl) throw validation('Unknown inspection template.', [{ field: 'templateCode', message: 'Unknown template' }]);
    const pending = await tx.query(`SELECT 1 FROM inspections WHERE milestone_id = $1 AND result = 'PENDING'`, [ms.id]);
    if (pending.rowCount) throw conflict('An inspection is already pending for this milestone.');

    const node = (await tx.query<{ id: string; assigned_position_id: string | null; activation_state: string }>(
      `SELECT n.id, n.assigned_position_id, n.activation_state FROM workflow_node_instances n
         JOIN workflow_node_templates nt ON nt.id = n.node_template_id JOIN workflow_instances wi ON wi.id = n.workflow_instance_id
        WHERE wi.project_id = $1 AND nt.config->>'milestone_code' = $2`,
      [projectId, input.milestoneCode],
    )).rows[0];
    if (!node || !['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(node.activation_state)) {
      throw conflict('Inspections can be requested only while the milestone is in progress.');
    }
    const r = await tx.query<{ id: string }>(
      `INSERT INTO inspections (project_id, milestone_id, inspection_template_id, requested_by, inspector_position_id, requested_at, result, observations, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING',NULL,$6,$6) RETURNING id`,
      [projectId, ms.id, tpl.id, actor.userId, node.assigned_position_id, ctx.now],
    );
    const inspectionId = r.rows[0]!.id;
    await createTask(tx, ctx, {
      projectId, projectCode: project.project_code, nodeId: node.id, taskType: 'INSPECTION', title: `Inspect: ${ms.name}`,
      description: input.note ?? 'Complete the checklist, capture geo-tagged evidence and record the result.',
      priority: 'HIGH', assignedPositionId: node.assigned_position_id, assignedUserId: node.assigned_position_id ? null : project.created_by,
      dueAt: addDays(ctx.now, 2), link: `/projects/${projectId}/inspections/${inspectionId}`,
    });
    await audit(tx, ctx, { action: 'inspection.requested', entityType: 'inspection', entityId: inspectionId, projectId, metadata: { milestone: input.milestoneCode, note: input.note ?? null } });
    await emit(tx, ctx, { aggregateType: 'PROJECT', aggregateId: projectId, eventType: 'InspectionRequested', payload: { inspectionId, milestone: ms.name, projectCode: project.project_code } });
    return inspectionId;
  });
  return getInspection(db, actor, id);
}

/**
 * Submit an inspection. The inspector's result is the verification: only here can verified progress rise.
 * FAIL raises a blocking quality issue (the root-blocker input) and a rectification task; PASS at 100% can complete the milestone.
 */
export async function submitInspection(db: Db, ctx: RequestContext, id: string, input: SubmitInspectionInput): Promise<InspectionDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const pre = (await tx.query<InspRow>(`${INSP_SELECT} WHERE i.id = $1`, [id])).rows[0];
    if (!pre || !(await projects.getProject(tx, pre.project_id, actor))) throw notFound('Inspection');
    await projects.lockProject(tx, pre.project_id);
    await tx.query(`SELECT 1 FROM inspections WHERE id = $1 FOR UPDATE`, [id]);
    const insp = (await tx.query<InspRow>(`${INSP_SELECT} WHERE i.id = $1`, [id])).rows[0]!;
    if (insp.result !== 'PENDING') throw conflict(`This inspection was already submitted (${insp.result}).`);
    const holds = insp.inspector_position_id ? await actorHoldsPosition(tx, actor.userId, insp.inspector_position_id) : false;
    if (!holds && !can(actor, 'workflow.manage')) throw forbidden('Only the holder of the assigned inspector position can submit this inspection.');

    const schema = insp.checklist_schema ?? [];
    const answered = new Map(input.checklist.map((c) => [c.itemCode, c]));
    const errors: { field: string; message: string }[] = [];
    for (const item of schema) if (!answered.has(item.code)) errors.push({ field: `checklist.${item.code}`, message: 'Answer every checklist item' });
    for (const code of answered.keys()) if (!schema.some((s) => s.code === code)) errors.push({ field: `checklist.${code}`, message: 'Unknown checklist item' });
    const failed = input.checklist.filter((c) => c.result === 'FAIL');
    if (input.result === 'PASS' && failed.length) errors.push({ field: 'result', message: 'A passing inspection cannot contain failed checklist items' });
    if (input.result !== 'PASS' && !input.observations?.trim()) errors.push({ field: 'observations', message: 'Observations are required for a fail or observation result' });
    if (input.result === 'FAIL' && input.verifiedProgress !== undefined) errors.push({ field: 'verifiedProgress', message: 'Verified progress cannot be recorded on a failed inspection' });
    if (errors.length) throw validation('The inspection is incomplete or inconsistent.', errors);

    const ms = insp.milestone_id ? await getMilestoneRow(tx, insp.milestone_id) : null;
    if (input.verifiedProgress !== undefined && ms && input.verifiedProgress < Number(ms.verified_progress)) {
      throw validation('Verified progress cannot decrease.', [{ field: 'verifiedProgress', message: `Already verified at ${ms.verified_progress}%` }]);
    }

    await tx.query(
      `UPDATE inspections SET result = $2, observations = $3, inspected_at = $4, inspector_user_id = $5, latitude = $6, longitude = $7, updated_at = $4 WHERE id = $1`,
      [id, input.result, input.observations ?? null, ctx.now, actor.userId, input.latitude ?? null, input.longitude ?? null],
    );
    for (const c of input.checklist) {
      const label = schema.find((s) => s.code === c.itemCode)?.label ?? c.itemCode;
      await tx.query(`INSERT INTO inspection_checklist_results (inspection_id, item_code, item_label, result, notes) VALUES ($1,$2,$3,$4,$5)`, [id, c.itemCode, label, c.result, c.notes ?? null]);
    }
    if (input.measurement && insp.milestone_id) {
      await tx.query(
        `INSERT INTO measurements (project_id, milestone_id, inspection_id, measurement_reference, measured_quantity, unit, measured_by, measured_at, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SUBMITTED',$8)`,
        [insp.project_id, insp.milestone_id, id, input.measurement.reference, input.measurement.quantity, input.measurement.unit, actor.userId, ctx.now],
      );
    }
    if (ms?.node_code) {
      const nid = await milestoneNodeId(tx, insp.project_id, insp.milestone_code!);
      if (nid) await wfRepo.completeOpenTasks(tx, nid, ['INSPECTION'], ctx.now);
    }

    if (input.verifiedProgress !== undefined && insp.milestone_id) {
      await tx.query(`UPDATE milestones SET verified_progress = $2, updated_at = $3 WHERE id = $1`, [insp.milestone_id, input.verifiedProgress, ctx.now]);
    }

    let raisedIssueId: string | null = null;
    if (input.result === 'FAIL') {
      const project = (await projects.getProject(tx, insp.project_id))!;
      const node = ms?.node_code ?? null;
      raisedIssueId = await createIssueTx(tx, ctx, project, {
        title: `Inspection failed: ${insp.milestone_name ?? 'milestone'}`,
        description: input.observations ?? undefined,
        category: 'quality',
        severity: 'HIGH',
        blocksNodes: node ? [node] : [],
        affectsNodes: [],
        milestoneId: insp.milestone_id,
      });
      await tx.query(`UPDATE issues SET impact = impact || $2::jsonb WHERE id = $1`, [raisedIssueId, JSON.stringify({ inspectionId: id, failedItems: failed.map((f) => f.itemCode) })]);
      const contractorUser = (await tx.query<{ user_id: string }>(
        `SELECT cu.user_id FROM contractor_project_assignments cpa JOIN contractor_users cu ON cu.contractor_id = cpa.contractor_id
          WHERE cpa.project_id = $1 AND cpa.status = 'ACTIVE' ORDER BY cu.created_at LIMIT 1`, [insp.project_id],
      )).rows[0];
      await createTask(tx, ctx, {
        projectId: insp.project_id, projectCode: insp.project_code, nodeId: null, taskType: 'RECTIFICATION', title: `Rectify and re-inspect: ${insp.milestone_name ?? 'milestone'}`,
        description: input.observations ?? null, priority: 'HIGH', assignedUserId: contractorUser?.user_id ?? actor.userId,
        dueAt: addDays(ctx.now, 7), link: `/projects/${insp.project_id}?tab=issues`,
      });
    }

    let completed = false;
    if (input.result === 'PASS' && insp.milestone_id) completed = await tryCompleteMilestone(tx, ctx, insp.milestone_id);

    await audit(tx, ctx, {
      action: 'inspection.submitted', entityType: 'inspection', entityId: id, projectId: insp.project_id,
      oldData: { result: 'PENDING' }, newData: { result: input.result, verifiedProgress: input.verifiedProgress ?? null },
      metadata: { milestone: insp.milestone_code, failedItems: failed.map((f) => f.itemCode), raisedIssueId, milestoneCompleted: completed, lat: input.latitude ?? null, lon: input.longitude ?? null },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: insp.project_id, eventType: 'InspectionCompleted',
      payload: { inspectionId: id, result: input.result, milestone: insp.milestone_name, projectCode: insp.project_code, raisedIssueId },
    });
  });
  return getInspection(db, actor, id);
}
