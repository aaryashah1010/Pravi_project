import type { Queryable } from '../../platform/db.js';

export interface OfficeRow {
  id: string;
  organization_id: string;
  organization_code: string;
  organization_name: string;
  parent_office_id: string | null;
  code: string;
  name: string;
  office_type: string;
}

export async function listOffices(db: Queryable, organizationId?: string): Promise<OfficeRow[]> {
  const r = await db.query<OfficeRow>(
    `SELECT o.id, o.organization_id, org.code AS organization_code, org.name AS organization_name,
            o.parent_office_id, o.code, o.name, o.office_type
       FROM offices o JOIN organizations org ON org.id = o.organization_id
      WHERE o.status = 'ACTIVE' AND ($1::uuid IS NULL OR o.organization_id = $1)
      ORDER BY org.code, o.office_type, o.code`,
    [organizationId ?? null],
  );
  return r.rows;
}

export interface PositionRow {
  id: string;
  office_id: string;
  office_name: string;
  position_code: string;
  display_name: string | null;
  designation: string;
  position_type_code: string;
  status: string;
  holder_user_id: string | null;
  holder_name: string | null;
  assignment_type: string | null;
}

export async function listPositions(db: Queryable, officeId?: string): Promise<PositionRow[]> {
  const r = await db.query<PositionRow>(
    `SELECT p.id, p.office_id, o.name AS office_name, p.position_code, p.display_name,
            pt.designation, pt.code AS position_type_code, p.status,
            h.user_id AS holder_user_id, h.display_name AS holder_name, h.assignment_type
       FROM positions p
       JOIN offices o ON o.id = p.office_id
       JOIN position_types pt ON pt.id = p.position_type_id
       LEFT JOIN v_current_position_holders h ON h.position_id = p.id AND h.assignment_type = 'PRIMARY'
      WHERE p.status <> 'INACTIVE' AND ($1::uuid IS NULL OR p.office_id = $1)
      ORDER BY o.code, p.position_code`,
    [officeId ?? null],
  );
  return r.rows;
}

export async function getPositionBrief(db: Queryable, positionId: string): Promise<PositionRow | null> {
  const r = await db.query<PositionRow>(
    `SELECT p.id, p.office_id, o.name AS office_name, p.position_code, p.display_name,
            pt.designation, pt.code AS position_type_code, p.status,
            h.user_id AS holder_user_id, h.display_name AS holder_name, h.assignment_type
       FROM positions p
       JOIN offices o ON o.id = p.office_id
       JOIN position_types pt ON pt.id = p.position_type_id
       LEFT JOIN v_current_position_holders h ON h.position_id = p.id
      WHERE p.id = $1
      ORDER BY CASE WHEN h.assignment_type = 'PRIMARY' THEN 0 ELSE 1 END LIMIT 1`,
    [positionId],
  );
  return r.rows[0] ?? null;
}

export async function listOfficeJurisdictions(db: Queryable) {
  const r = await db.query<{ office_id: string; code: string; name: string; jurisdiction_type: string; coverage_type: string }>(
    `SELECT oj.office_id, j.code, j.name, j.jurisdiction_type, oj.coverage_type
       FROM office_jurisdictions oj JOIN jurisdictions j ON j.id = oj.jurisdiction_id ORDER BY j.code`,
  );
  return r.rows;
}

export async function listOrganizations(db: Queryable) {
  const r = await db.query<{ id: string; code: string; name: string; organization_type: string }>(
    `SELECT id, code, name, organization_type FROM organizations WHERE status = 'ACTIVE' ORDER BY code`,
  );
  return r.rows;
}

export async function listJurisdictions(db: Queryable) {
  const r = await db.query<{ id: string; code: string; name: string; jurisdiction_type: string; parent_jurisdiction_id: string | null }>(
    `SELECT id, code, name, jurisdiction_type, parent_jurisdiction_id FROM jurisdictions WHERE status = 'ACTIVE' ORDER BY jurisdiction_type, code`,
  );
  return r.rows;
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  status: string;
  roles: string[];
  positions: string[];
}

export async function listUsers(db: Queryable): Promise<UserRow[]> {
  const r = await db.query<UserRow>(
    `SELECT u.id, u.email, u.display_name, u.status,
            COALESCE((SELECT array_agg(DISTINCT r.code ORDER BY r.code) FROM user_role_assignments ura
                        JOIN roles r ON r.id = ura.role_id WHERE ura.user_id = u.id AND ura.is_active), '{}') AS roles,
            COALESCE((SELECT array_agg(v.position_code ORDER BY v.position_code) FROM v_current_position_holders v
                       WHERE v.user_id = u.id), '{}') AS positions
       FROM app_users u ORDER BY u.display_name`,
  );
  return r.rows;
}

export async function listProjectTypes(db: Queryable) {
  const r = await db.query<{ id: string; code: string; name: string }>(
    `SELECT id, code, name FROM project_types WHERE status = 'ACTIVE' ORDER BY code`,
  );
  return r.rows;
}
