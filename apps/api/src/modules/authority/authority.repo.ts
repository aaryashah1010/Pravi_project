import type { Queryable } from '../../platform/db.js';
import type { OfficeLevel, SeatCandidate } from './domain/decide.js';

export interface CandidateRow {
  id: string;
  code: string;
  required_position_type_id: string;
  routing_scope: string;
  priority: number;
  conditions: Record<string, unknown>;
  has_department: boolean;
  has_project_type: boolean;
  has_jurisdiction_type: boolean;
  has_cost_band: boolean;
  rule_version_id: string;
  rule_code: string;
  enforcement_mode: 'ENFORCEABLE' | 'ADVISORY_ONLY' | 'NON_ENFORCEABLE';
  verification_status: 'DRAFT' | 'VERIFIED' | 'UNVERIFIED' | 'SUPERSEDED' | 'DISABLED';
  effective_from: string | null;
  effective_to: string | null;
  scope: Record<string, unknown>;
  rv_conditions: Record<string, unknown>;
  action: Record<string, unknown>;
}

/**
 * Candidate authority rules for a decision. Improves on db/queries/001: joins rule_versions so executability can be
 * checked (the caller filters with isExecutable), applies jurisdiction_type, and never invents a match.
 */
export async function listCandidates(
  db: Queryable,
  p: { departmentId: string; projectTypeId: string; cost: string; jurisdictionType: string | null; decisionType: string; today: string },
): Promise<CandidateRow[]> {
  const r = await db.query<CandidateRow>(
    `SELECT ar.id, ar.code, ar.required_position_type_id, ar.routing_scope, ar.priority, ar.conditions,
            (ar.department_organization_id IS NOT NULL) AS has_department,
            (ar.project_type_id IS NOT NULL) AS has_project_type,
            (ar.jurisdiction_type IS NOT NULL) AS has_jurisdiction_type,
            (ar.min_cost IS NOT NULL OR ar.max_cost IS NOT NULL) AS has_cost_band,
            rv.id AS rule_version_id, rv.rule_code, rv.enforcement_mode, rv.verification_status, rv.effective_from, rv.effective_to,
            rv.scope, rv.conditions AS rv_conditions, rv.action
       FROM authority_rules ar
       JOIN rule_versions rv ON rv.id = ar.rule_version_id
      WHERE ar.status = 'ACTIVE' AND ar.decision_type = $1
        AND (ar.department_organization_id IS NULL OR ar.department_organization_id = $2)
        AND (ar.project_type_id IS NULL OR ar.project_type_id = $3)
        AND (ar.jurisdiction_type IS NULL OR ar.jurisdiction_type = $4)
        AND (ar.min_cost IS NULL OR $5::numeric >= ar.min_cost)
        AND (ar.max_cost IS NULL OR $5::numeric <= ar.max_cost)
        AND (ar.valid_from IS NULL OR ar.valid_from <= $6::date)
        AND (ar.valid_to IS NULL OR ar.valid_to >= $6::date)
      ORDER BY ar.code`,
    [p.decisionType, p.departmentId, p.projectTypeId, p.jurisdictionType, p.cost, p.today],
  );
  return r.rows;
}

interface SeatRow {
  level: number;
  office_id: string;
  office_name: string;
  position_id: string | null;
  position_code: string | null;
  user_id: string | null;
  display_name: string | null;
  assignment_type: string | null;
}

function toLevels(rows: SeatRow[]): OfficeLevel[] {
  const levels = new Map<number, OfficeLevel>();
  for (const r of rows) {
    let lvl = levels.get(r.level);
    if (!lvl) {
      lvl = { officeId: r.office_id, officeName: r.office_name, seats: [] };
      levels.set(r.level, lvl);
    }
    if (!r.position_id) continue;
    let seat: SeatCandidate | undefined = lvl.seats.find((s) => s.positionId === r.position_id);
    if (!seat) {
      seat = { positionId: r.position_id, positionCode: r.position_code!, officeId: r.office_id, holders: [] };
      lvl.seats.push(seat);
    }
    if (r.user_id && !seat.holders.some((h) => h.userId === r.user_id)) {
      seat.holders.push({ userId: r.user_id, displayName: r.display_name!, assignmentType: r.assignment_type! });
    }
  }
  return [...levels.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
}

const SEAT_JOIN = `
  LEFT JOIN positions p ON p.office_id = l.office_id AND p.position_type_id = $POS AND p.status <> 'INACTIVE'
  LEFT JOIN v_current_position_holders h ON h.position_id = p.id`;

/** Offices from the owning office upward through parent_office_id (nearest first). */
export async function levelsByOwningOffice(db: Queryable, owningOfficeId: string, positionTypeId: string): Promise<OfficeLevel[]> {
  const r = await db.query<SeatRow>(
    `WITH RECURSIVE chain AS (
       SELECT id AS office_id, name AS office_name, parent_office_id, 0 AS level FROM offices WHERE id = $1
       UNION ALL
       SELECT o.id, o.name, o.parent_office_id, c.level + 1 FROM offices o JOIN chain c ON o.id = c.parent_office_id WHERE c.level < 20
     )
     SELECT l.level, l.office_id, l.office_name, p.id AS position_id, p.position_code,
            h.user_id, h.display_name, h.assignment_type
       FROM chain l ${SEAT_JOIN.replace('$POS', '$2')}
      ORDER BY l.level, p.position_code`,
    [owningOfficeId, positionTypeId],
  );
  return toLevels(r.rows);
}

/** Offices (of the department) covering the project's jurisdiction, then each parent jurisdiction (nearest first). */
export async function levelsByJurisdiction(db: Queryable, jurisdictionId: string, organizationId: string, positionTypeId: string): Promise<OfficeLevel[]> {
  const r = await db.query<SeatRow>(
    `WITH RECURSIVE jchain AS (
       SELECT id, parent_jurisdiction_id, 0 AS level FROM jurisdictions WHERE id = $1
       UNION ALL
       SELECT j.id, j.parent_jurisdiction_id, c.level + 1 FROM jurisdictions j JOIN jchain c ON j.id = c.parent_jurisdiction_id WHERE c.level < 20
     ), l AS (
       SELECT DISTINCT o.id AS office_id, o.name AS office_name, jc.level
         FROM jchain jc
         JOIN office_jurisdictions oj ON oj.jurisdiction_id = jc.id
         JOIN offices o ON o.id = oj.office_id
        WHERE o.organization_id = $2 AND o.status = 'ACTIVE'
     )
     SELECT l.level, l.office_id, l.office_name, p.id AS position_id, p.position_code,
            h.user_id, h.display_name, h.assignment_type
       FROM l ${SEAT_JOIN.replace('$POS', '$3')}
      ORDER BY l.level, l.office_name, p.position_code`,
    [jurisdictionId, organizationId, positionTypeId],
  );
  return toLevels(r.rows);
}

export interface ResolutionInsert {
  projectId: string;
  workflowNodeInstanceId: string | null;
  approvalType: string;
  authorityRuleId: string | null;
  requiredPositionTypeId: string | null;
  resolvedPositionId: string | null;
  resolvedUserId: string | null;
  status: string;
  candidateCount: number;
  snapshot: Record<string, unknown>;
  at: Date;
}

export async function insertResolution(tx: Queryable, r: ResolutionInsert): Promise<string> {
  const res = await tx.query<{ id: string }>(
    `INSERT INTO authority_resolutions (project_id, workflow_node_instance_id, approval_type, authority_rule_id, required_position_type_id,
                                        resolved_position_id, resolved_user_id, resolution_status, candidate_count, resolution_snapshot, resolved_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id`,
    [r.projectId, r.workflowNodeInstanceId, r.approvalType, r.authorityRuleId, r.requiredPositionTypeId, r.resolvedPositionId,
     r.resolvedUserId, r.status, r.candidateCount, JSON.stringify(r.snapshot), r.at],
  );
  return res.rows[0]!.id;
}

export async function updateResolutionManual(
  tx: Queryable,
  id: string,
  u: { positionId: string; userId: string | null; snapshot: Record<string, unknown>; at: Date },
): Promise<void> {
  await tx.query(
    `UPDATE authority_resolutions SET resolved_position_id = $2, resolved_user_id = $3, resolution_status = 'MANUAL_REVIEW',
            resolution_snapshot = $4, resolved_at = $5 WHERE id = $1`,
    [id, u.positionId, u.userId, JSON.stringify(u.snapshot), u.at],
  );
}

export interface ResolutionRow {
  id: string;
  project_id: string;
  approval_type: string;
  authority_rule_id: string | null;
  authority_rule_code: string | null;
  authority_rule_version_id: string | null;
  required_position_type_id: string | null;
  resolved_position_id: string | null;
  resolved_user_id: string | null;
  resolution_status: string;
  candidate_count: number;
  resolution_snapshot: Record<string, unknown>;
  resolved_at: Date | null;
}

export async function getResolution(db: Queryable, id: string): Promise<ResolutionRow | null> {
  const r = await db.query<ResolutionRow>(
    `SELECT res.id, res.project_id, res.approval_type, res.authority_rule_id, rl.code AS authority_rule_code,
            rl.rule_version_id AS authority_rule_version_id, res.required_position_type_id, res.resolved_position_id,
            res.resolved_user_id, res.resolution_status, res.candidate_count, res.resolution_snapshot, res.resolved_at
       FROM authority_resolutions res
       LEFT JOIN authority_rules rl ON rl.id = res.authority_rule_id
      WHERE res.id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}
