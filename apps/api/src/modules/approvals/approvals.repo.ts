import type { Queryable } from '../../platform/db.js';
import { type Actor, hasGlobalScope } from '../../platform/context.js';
import { scopeClause } from '../projects/projects.repo.js';

export interface CaseRow {
  id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  project_cost: string;
  workflow_node_instance_id: string;
  node_code: string;
  node_name: string;
  node_execution_state: string;
  approval_type: string;
  status: 'PENDING' | 'IN_REVIEW' | 'RETURNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decision: string | null;
  decision_reason: string | null;
  submitted_at: Date | null;
  submitted_by: string | null;
  decided_at: Date | null;
  created_at: Date;
  authority_resolution_id: string | null;
  resolution_status: string | null;
  resolved_position_id: string | null;
  resolved_position_code: string | null;
  resolved_designation: string | null;
  resolved_office_name: string | null;
  authority_rule_code: string | null;
  authority_rule_version_id: string | null;
  authority_synthetic: boolean;
  resolution_snapshot: Record<string, unknown> | null;
  node_rule_version_id: string | null;
  node_due_at: Date | null;
  node_eligible_at: Date | null;
}

const CASE_SELECT = `
  SELECT ac.id, ac.project_id, p.project_code, p.name AS project_name, p.estimated_cost AS project_cost,
         ac.workflow_node_instance_id, n.node_code, nt.name AS node_name, n.execution_state AS node_execution_state,
         ac.approval_type, ac.status, ac.decision, ac.decision_reason, ac.submitted_at, ac.submitted_by, ac.decided_at, ac.created_at,
         ac.authority_resolution_id, res.resolution_status, res.resolved_position_id,
         pos.position_code AS resolved_position_code, pt.designation AS resolved_designation, off.name AS resolved_office_name,
         rl.code AS authority_rule_code, rl.rule_version_id AS authority_rule_version_id,
         COALESCE(rv.scope->>'synthetic', 'false') = 'true' AS authority_synthetic,
         res.resolution_snapshot, n.source_rule_version_id AS node_rule_version_id, n.due_at AS node_due_at, n.eligible_at AS node_eligible_at
    FROM approval_cases ac
    JOIN projects p ON p.id = ac.project_id
    JOIN workflow_node_instances n ON n.id = ac.workflow_node_instance_id
    JOIN workflow_node_templates nt ON nt.id = n.node_template_id
    LEFT JOIN authority_resolutions res ON res.id = ac.authority_resolution_id
    LEFT JOIN authority_rules rl ON rl.id = res.authority_rule_id
    LEFT JOIN rule_versions rv ON rv.id = rl.rule_version_id
    LEFT JOIN positions pos ON pos.id = res.resolved_position_id
    LEFT JOIN position_types pt ON pt.id = pos.position_type_id
    LEFT JOIN offices off ON off.id = pos.office_id`;

export async function getCase(db: Queryable, id: string): Promise<CaseRow | null> {
  const r = await db.query<CaseRow>(`${CASE_SELECT} WHERE ac.id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function getCaseByNode(db: Queryable, nodeId: string): Promise<CaseRow | null> {
  const r = await db.query<CaseRow>(`${CASE_SELECT} WHERE ac.workflow_node_instance_id = $1`, [nodeId]);
  return r.rows[0] ?? null;
}

/** Row lock so two concurrent decisions serialise; the loser then sees a non-IN_REVIEW status => 409. */
export async function lockCase(tx: Queryable, id: string): Promise<{ status: string; project_id: string } | null> {
  const r = await tx.query<{ status: string; project_id: string }>(`SELECT status, project_id FROM approval_cases WHERE id = $1 FOR UPDATE`, [id]);
  return r.rows[0] ?? null;
}

export async function listCases(db: Queryable, actor: Actor, f: { status?: string; projectId?: string; mine?: boolean }): Promise<CaseRow[]> {
  const params: unknown[] = [];
  const where: string[] = [scopeClause(actor, 'p', params)];
  if (f.status === 'open') where.push(`ac.status IN ('PENDING','IN_REVIEW','RETURNED')`);
  else if (f.status) {
    params.push(f.status);
    where.push(`ac.status = $${params.length}`);
  }
  if (f.projectId) {
    params.push(f.projectId);
    where.push(`ac.project_id = $${params.length}`);
  }
  if (f.mine && !hasGlobalScope(actor)) {
    params.push(actor.positions.map((p) => p.positionId));
    where.push(`res.resolved_position_id = ANY($${params.length}::uuid[])`);
  } else if (f.mine) {
    params.push(actor.positions.map((p) => p.positionId));
    where.push(`res.resolved_position_id = ANY($${params.length}::uuid[])`);
  }
  const r = await db.query<CaseRow>(`${CASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY ac.created_at DESC LIMIT 200`, params);
  return r.rows;
}

export async function insertCase(
  tx: Queryable,
  c: { projectId: string; nodeId: string; approvalType: string; resolutionId: string; at: Date },
): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO approval_cases (project_id, workflow_node_instance_id, approval_type, status, authority_resolution_id, created_at, updated_at)
     VALUES ($1,$2,$3,'PENDING',$4,$5,$5) RETURNING id`,
    [c.projectId, c.nodeId, c.approvalType, c.resolutionId, c.at],
  );
  return r.rows[0]!.id;
}

export async function updateCase(
  tx: Queryable,
  id: string,
  p: { status: string; decision?: string | null; reason?: string | null; submittedAt?: Date | null; submittedBy?: string | null; decidedAt?: Date | null; resolutionId?: string | null; at: Date },
): Promise<void> {
  await tx.query(
    `UPDATE approval_cases SET status = $2, decision = $3, decision_reason = $4,
            submitted_at = COALESCE($5, submitted_at), submitted_by = COALESCE($6, submitted_by),
            decided_at = $7, authority_resolution_id = COALESCE($8, authority_resolution_id), updated_at = $9
      WHERE id = $1`,
    [id, p.status, p.decision ?? null, p.reason ?? null, p.submittedAt ?? null, p.submittedBy ?? null, p.decidedAt ?? null, p.resolutionId ?? null, p.at],
  );
}

export async function insertDecision(
  tx: Queryable,
  d: { caseId: string; action: string; actorUserId: string | null; actorPositionId: string | null; reason?: string | null; at: Date },
): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO approval_decisions (approval_case_id, action, actor_user_id, actor_position_id, reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [d.caseId, d.action, d.actorUserId, d.actorPositionId, d.reason ?? null, d.at],
  );
  return r.rows[0]!.id;
}

export interface DecisionRow {
  id: string;
  action: string;
  reason: string | null;
  created_at: Date;
  actor_name: string | null;
  actor_position_code: string | null;
  actor_designation: string | null;
}

export async function listDecisions(db: Queryable, caseId: string): Promise<DecisionRow[]> {
  const r = await db.query<DecisionRow>(
    `SELECT d.id, d.action, d.reason, d.created_at, u.display_name AS actor_name, p.position_code AS actor_position_code, pt.designation AS actor_designation
       FROM approval_decisions d
       LEFT JOIN app_users u ON u.id = d.actor_user_id
       LEFT JOIN positions p ON p.id = d.actor_position_id
       LEFT JOIN position_types pt ON pt.id = p.position_type_id
      WHERE d.approval_case_id = $1 ORDER BY d.created_at, d.id`,
    [caseId],
  );
  return r.rows;
}

export async function insertSanction(
  tx: Queryable,
  s: { projectId: string; caseId: string; type: string; amount: string; reference: string; date: string; ruleVersionId: string | null; at: Date },
): Promise<void> {
  await tx.query(
    `INSERT INTO sanctions (project_id, approval_case_id, sanction_type, sanctioned_amount, sanction_reference, sanction_date, source_rule_version_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (approval_case_id) DO NOTHING`,
    [s.projectId, s.caseId, s.type, s.amount, s.reference, s.date, s.ruleVersionId, s.at],
  );
}

/** Does this actor currently hold the given seat? Decisions are authorised against the seat, never a stored person. */
export async function actorHoldsPosition(db: Queryable, userId: string, positionId: string): Promise<boolean> {
  const r = await db.query(`SELECT 1 FROM v_current_position_holders WHERE user_id = $1 AND position_id = $2 LIMIT 1`, [userId, positionId]);
  return (r.rowCount ?? 0) > 0;
}

export async function requiredDocsStatus(db: Queryable, nodeId: string) {
  const r = await db.query<{ code: string; name: string; status: string; required: boolean }>(
    `SELECT dt.code, dt.name, prd.status, prd.required
       FROM project_required_documents prd JOIN document_types dt ON dt.id = prd.document_type_id
      WHERE prd.workflow_node_instance_id = $1 ORDER BY dt.code`,
    [nodeId],
  );
  return r.rows;
}
