import type { Queryable } from '../../platform/db.js';
import { type Actor, hasGlobalScope } from '../../platform/context.js';

export interface ProjectRow {
  id: string;
  project_code: string;
  name: string;
  project_type_id: string;
  project_type_code: string;
  project_type_name: string;
  department_organization_id: string;
  department_code: string;
  department_name: string;
  owning_office_id: string;
  owning_office_name: string;
  primary_jurisdiction_id: string | null;
  jurisdiction_code: string | null;
  jurisdiction_name: string | null;
  jurisdiction_type: string | null;
  estimated_cost: string;
  currency: string;
  funding_source_id: string | null;
  attributes: Record<string, unknown>;
  lifecycle_stage: string;
  operational_status: string;
  version_no: number;
  is_demo: boolean;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  has_workflow: boolean;
  open_task_count: number;
  open_approval_count: number;
}

const PROJECT_SELECT = `
  SELECT p.id, p.project_code, p.name, p.project_type_id, pt.code AS project_type_code, pt.name AS project_type_name,
         p.department_organization_id, org.code AS department_code, org.name AS department_name,
         p.owning_office_id, o.name AS owning_office_name,
         p.primary_jurisdiction_id, j.code AS jurisdiction_code, j.name AS jurisdiction_name, j.jurisdiction_type,
         p.estimated_cost, p.currency, p.funding_source_id, p.attributes, p.lifecycle_stage, p.operational_status,
         p.version_no, p.is_demo, p.created_by, u.display_name AS created_by_name, p.created_at,
         EXISTS (SELECT 1 FROM workflow_instances wi WHERE wi.project_id = p.id) AS has_workflow,
         (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status IN ('PENDING','IN_PROGRESS','OVERDUE','BLOCKED')) AS open_task_count,
         (SELECT count(*)::int FROM approval_cases ac WHERE ac.project_id = p.id AND ac.status IN ('PENDING','IN_REVIEW','RETURNED')) AS open_approval_count
    FROM projects p
    JOIN project_types pt ON pt.id = p.project_type_id
    JOIN organizations org ON org.id = p.department_organization_id
    JOIN offices o ON o.id = p.owning_office_id
    LEFT JOIN jurisdictions j ON j.id = p.primary_jurisdiction_id
    JOIN app_users u ON u.id = p.created_by`;

/**
 * Project visibility (deny by default): global non-contractor role, OR department in one of the actor's role scopes,
 * OR explicit project membership (user or a position the actor currently holds), OR (contractors) an active assignment.
 */
export function scopeClause(actor: Actor, alias: string, params: unknown[]): string {
  if (hasGlobalScope(actor)) return 'TRUE';
  const parts: string[] = [];
  const orgIds = [...new Set(actor.roles.filter((r) => r.organizationId && r.code !== 'CONTRACTOR').map((r) => r.organizationId!))];
  if (orgIds.length) {
    params.push(orgIds);
    parts.push(`${alias}.department_organization_id = ANY($${params.length}::uuid[])`);
  }
  params.push(actor.userId);
  const u = params.length;
  params.push(actor.positions.map((p) => p.positionId));
  const pp = params.length;
  parts.push(
    `EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = ${alias}.id
              AND (pm.user_id = $${u} OR pm.position_id = ANY($${pp}::uuid[])) AND (pm.ends_at IS NULL OR pm.ends_at > now()))`,
  );
  if (actor.contractorIds.length) {
    params.push(actor.contractorIds);
    parts.push(
      `EXISTS (SELECT 1 FROM contractor_project_assignments cpa WHERE cpa.project_id = ${alias}.id AND cpa.status = 'ACTIVE'
                AND cpa.contractor_id = ANY($${params.length}::uuid[]))`,
    );
  }
  return `(${parts.join(' OR ')})`;
}

export async function getProject(db: Queryable, id: string, actor?: Actor | null): Promise<ProjectRow | null> {
  const params: unknown[] = [id];
  const scope = actor ? ` AND ${scopeClause(actor, 'p', params)}` : '';
  const r = await db.query<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = $1${scope}`, params);
  return r.rows[0] ?? null;
}

export async function getProjectByCode(db: Queryable, code: string): Promise<ProjectRow | null> {
  const r = await db.query<ProjectRow>(`${PROJECT_SELECT} WHERE p.project_code = $1`, [code]);
  return r.rows[0] ?? null;
}

/** Row-lock the project so lifecycle/status transitions serialise (used inside a transaction). */
export async function lockProject(tx: Queryable, id: string): Promise<void> {
  await tx.query(`SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`, [id]);
}

export async function listProjects(
  db: Queryable,
  actor: Actor,
  f: { status?: string; stage?: string; q?: string; limit?: number },
): Promise<ProjectRow[]> {
  const params: unknown[] = [];
  const where: string[] = [scopeClause(actor, 'p', params)];
  if (f.status) {
    params.push(f.status);
    where.push(`p.operational_status = $${params.length}`);
  }
  if (f.stage) {
    params.push(f.stage);
    where.push(`p.lifecycle_stage = $${params.length}`);
  }
  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`(p.project_code ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }
  params.push(Math.min(f.limit ?? 100, 200));
  const r = await db.query<ProjectRow>(
    `${PROJECT_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC, p.project_code LIMIT $${params.length}`,
    params,
  );
  return r.rows;
}

export async function nextProjectCode(tx: Queryable, at: Date): Promise<string> {
  const r = await tx.query<{ n: string }>(`SELECT nextval('project_code_seq')::text AS n`);
  return `INF-${at.getUTCFullYear()}-${r.rows[0]!.n.padStart(5, '0')}`;
}

export interface InsertProject {
  code: string;
  name: string;
  projectTypeId: string;
  departmentOrganizationId: string;
  owningOfficeId: string;
  primaryJurisdictionId: string | null;
  estimatedCost: string;
  fundingSourceId: string | null;
  attributes: Record<string, unknown>;
  isDemo: boolean;
  createdBy: string;
  at: Date;
}

export async function insertProject(tx: Queryable, p: InsertProject): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO projects (project_code, name, project_type_id, department_organization_id, owning_office_id, primary_jurisdiction_id,
                           estimated_cost, funding_source_id, attributes, is_demo, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
    [p.code, p.name, p.projectTypeId, p.departmentOrganizationId, p.owningOfficeId, p.primaryJurisdictionId, p.estimatedCost,
     p.fundingSourceId, JSON.stringify(p.attributes), p.isDemo, p.createdBy, p.at],
  );
  return r.rows[0]!.id;
}

export async function insertProjectJurisdiction(tx: Queryable, projectId: string, jurisdictionId: string): Promise<void> {
  await tx.query(
    `INSERT INTO project_jurisdictions (project_id, jurisdiction_id, relation_type) VALUES ($1,$2,'PRIMARY') ON CONFLICT DO NOTHING`,
    [projectId, jurisdictionId],
  );
}

export interface SiteInput {
  addressLine?: string;
  city?: string;
  district?: string;
  taluka?: string;
  latitude?: number;
  longitude?: number;
  landOwner?: string;
  possessionStatus?: string;
}

export async function upsertSite(tx: Queryable, projectId: string, s: SiteInput, at: Date): Promise<void> {
  await tx.query(
    `INSERT INTO project_sites (project_id, address_line, city, district, taluka, latitude, longitude, land_owner, possession_status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'UNKNOWN'),$10,$10)
     ON CONFLICT (project_id) DO UPDATE SET
       address_line = COALESCE($2, project_sites.address_line), city = COALESCE($3, project_sites.city),
       district = COALESCE($4, project_sites.district), taluka = COALESCE($5, project_sites.taluka),
       latitude = COALESCE($6, project_sites.latitude), longitude = COALESCE($7, project_sites.longitude),
       land_owner = COALESCE($8, project_sites.land_owner),
       possession_status = COALESCE($9, project_sites.possession_status), updated_at = $10`,
    [projectId, s.addressLine ?? null, s.city ?? null, s.district ?? null, s.taluka ?? null, s.latitude ?? null,
     s.longitude ?? null, s.landOwner ?? null, s.possessionStatus ?? null, at],
  );
}

export interface SiteRow {
  address_line: string | null;
  city: string | null;
  district: string | null;
  taluka: string | null;
  latitude: string | null;
  longitude: string | null;
  land_owner: string | null;
  possession_status: string;
  survey_status: string;
  soil_investigation_status: string;
}

export async function getSite(db: Queryable, projectId: string): Promise<SiteRow | null> {
  const r = await db.query<SiteRow>(
    `SELECT address_line, city, district, taluka, latitude::text, longitude::text, land_owner, possession_status, survey_status, soil_investigation_status
       FROM project_sites WHERE project_id = $1`,
    [projectId],
  );
  return r.rows[0] ?? null;
}

export async function insertProposal(
  tx: Queryable,
  p: { projectId: string; justification: string; estimate: string; fundingNotes?: string; userId: string; at: Date },
): Promise<void> {
  await tx.query(
    `INSERT INTO project_proposals (project_id, version_no, justification, preliminary_estimate, funding_notes, status, created_at)
     VALUES ($1, 1, $2, $3, $4, 'DRAFT', $5)`,
    [p.projectId, p.justification, p.estimate, p.fundingNotes ?? null, p.at],
  );
}

export async function getLatestProposal(db: Queryable, projectId: string) {
  const r = await db.query<{ version_no: number; status: string; justification: string; preliminary_estimate: string }>(
    `SELECT version_no, status, justification, preliminary_estimate FROM project_proposals WHERE project_id = $1 ORDER BY version_no DESC LIMIT 1`,
    [projectId],
  );
  return r.rows[0] ?? null;
}

export async function setProposalStatus(tx: Queryable, projectId: string, from: string, to: string, userId: string, at: Date): Promise<number> {
  const r = await tx.query(
    `UPDATE project_proposals SET status = $3, submitted_by = $4, submitted_at = $5
      WHERE project_id = $1 AND status = $2 AND version_no = (SELECT max(version_no) FROM project_proposals WHERE project_id = $1)`,
    [projectId, from, to, userId, at],
  );
  return r.rowCount ?? 0;
}

export async function insertMember(tx: Queryable, projectId: string, m: { userId?: string; positionId?: string; type: string; at: Date }): Promise<void> {
  const unique = m.userId ? `ON CONFLICT (project_id, user_id, member_type) WHERE user_id IS NOT NULL DO NOTHING` : `ON CONFLICT (project_id, position_id, member_type) WHERE position_id IS NOT NULL DO NOTHING`;
  await tx.query(
    `INSERT INTO project_members (project_id, user_id, position_id, member_type, starts_at) VALUES ($1,$2,$3,$4,$5) ${unique}`,
    [projectId, m.userId ?? null, m.positionId ?? null, m.type, m.at],
  );
}

export async function listMembers(db: Queryable, projectId: string) {
  const r = await db.query<{ member_type: string; user_name: string | null; position_code: string | null }>(
    `SELECT pm.member_type, u.display_name AS user_name, p.position_code
       FROM project_members pm LEFT JOIN app_users u ON u.id = pm.user_id LEFT JOIN positions p ON p.id = pm.position_id
      WHERE pm.project_id = $1 ORDER BY pm.member_type`,
    [projectId],
  );
  return r.rows;
}

export async function updateProjectVersioned(
  tx: Queryable,
  id: string,
  expectedVersion: number,
  f: { name?: string; attributes?: Record<string, unknown>; estimatedCost?: string },
  at: Date,
): Promise<boolean> {
  const r = await tx.query(
    `UPDATE projects SET name = COALESCE($3, name), attributes = COALESCE($4::jsonb, attributes),
            estimated_cost = COALESCE($5::numeric, estimated_cost), version_no = version_no + 1, updated_at = $6
      WHERE id = $1 AND version_no = $2`,
    [id, expectedVersion, f.name ?? null, f.attributes ? JSON.stringify(f.attributes) : null, f.estimatedCost ?? null, at],
  );
  return (r.rowCount ?? 0) === 1;
}

export async function setProjectState(
  tx: Queryable,
  id: string,
  s: { lifecycleStage?: string; operationalStatus?: string },
  at: Date,
): Promise<void> {
  await tx.query(
    `UPDATE projects SET lifecycle_stage = COALESCE($2, lifecycle_stage), operational_status = COALESCE($3, operational_status),
            version_no = version_no + 1, updated_at = $4 WHERE id = $1`,
    [id, s.lifecycleStage ?? null, s.operationalStatus ?? null, at],
  );
}

export async function getFundingSourceId(db: Queryable, code: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(`SELECT id FROM funding_sources WHERE code = $1 AND status = 'ACTIVE'`, [code]);
  return r.rows[0]?.id ?? null;
}

export async function getProjectTypeId(db: Queryable, code: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(`SELECT id FROM project_types WHERE code = $1 AND status = 'ACTIVE'`, [code]);
  return r.rows[0]?.id ?? null;
}

export async function officeBelongsToOrg(db: Queryable, officeId: string, orgId: string): Promise<boolean> {
  const r = await db.query(`SELECT 1 FROM offices WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE'`, [officeId, orgId]);
  return (r.rowCount ?? 0) > 0;
}

/** Facts used by the rule DSL. Jurisdiction chain = the project's jurisdiction and every ancestor. Sequential on purpose: `db` may be a single transaction client. */
export async function loadFactRows(db: Queryable, projectId: string) {
  const proj = await getProject(db, projectId);
  const site = await getSite(db, projectId);
  const chain = await db.query<{ code: string; jurisdiction_type: string }>(
    `WITH RECURSIVE chain AS (
       SELECT j.id, j.code, j.jurisdiction_type, j.parent_jurisdiction_id, 0 AS depth
         FROM jurisdictions j JOIN projects p ON p.primary_jurisdiction_id = j.id WHERE p.id = $1
       UNION ALL
       SELECT j.id, j.code, j.jurisdiction_type, j.parent_jurisdiction_id, c.depth + 1
         FROM jurisdictions j JOIN chain c ON j.id = c.parent_jurisdiction_id WHERE c.depth < 20
     ) SELECT code, jurisdiction_type FROM chain ORDER BY depth`,
    [projectId],
  );
  return { project: proj, site, jurisdictionChain: chain.rows };
}
