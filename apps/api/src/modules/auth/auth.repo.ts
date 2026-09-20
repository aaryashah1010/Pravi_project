import type { Queryable } from '../../platform/db.js';
import type { Actor } from '../../platform/context.js';

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  status: string;
  password_hash: string | null;
}

export async function findUserByEmail(db: Queryable, email: string): Promise<UserRow | null> {
  const r = await db.query<UserRow>(
    `SELECT id, email, display_name, status, password_hash FROM app_users WHERE lower(email) = lower($1)`,
    [email],
  );
  return r.rows[0] ?? null;
}

export async function findUserById(db: Queryable, id: string): Promise<UserRow | null> {
  const r = await db.query<UserRow>(
    `SELECT id, email, display_name, status, password_hash FROM app_users WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

export async function touchLastLogin(db: Queryable, userId: string, at: Date): Promise<void> {
  await db.query(`UPDATE app_users SET last_login_at = $2 WHERE id = $1`, [userId, at]);
}

const ROLE_FILTER = `ura.user_id = $1 AND ura.is_active = TRUE AND ura.starts_at <= $2
                     AND (ura.ends_at IS NULL OR ura.ends_at >= $2) AND r.status = 'ACTIVE'`;

export async function loadActor(db: Queryable, userId: string, at: Date): Promise<Actor | null> {
  const user = await findUserById(db, userId);
  if (!user || user.status !== 'ACTIVE') return null;

  const [roles, perms, positions, contractors] = await Promise.all([
    db.query(
      `SELECT r.code, ura.organization_id, ura.office_id, ura.jurisdiction_id
         FROM user_role_assignments ura JOIN roles r ON r.id = ura.role_id
        WHERE ${ROLE_FILTER} ORDER BY r.code`,
      [userId, at],
    ),
    db.query(
      `SELECT DISTINCT p.code
         FROM user_role_assignments ura
         JOIN roles r ON r.id = ura.role_id
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ${ROLE_FILTER}`,
      [userId, at],
    ),
    db.query(
      `SELECT v.position_id, v.position_code, v.position_type_id, pt.code AS position_type_code, pt.designation,
              v.office_id, o.name AS office_name, o.organization_id, v.assignment_type
         FROM v_current_position_holders v
         JOIN position_types pt ON pt.id = v.position_type_id
         JOIN offices o ON o.id = v.office_id
        WHERE v.user_id = $1
        ORDER BY CASE WHEN v.assignment_type = 'PRIMARY' THEN 0 ELSE 1 END, v.position_code`,
      [userId],
    ),
    db.query(`SELECT contractor_id FROM contractor_users WHERE user_id = $1`, [userId]),
  ]);

  return {
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    roles: roles.rows.map((r) => ({
      code: r.code,
      organizationId: r.organization_id,
      officeId: r.office_id,
      jurisdictionId: r.jurisdiction_id,
    })),
    permissions: new Set(perms.rows.map((p) => p.code as string)),
    positions: positions.rows.map((p) => ({
      positionId: p.position_id,
      positionCode: p.position_code,
      positionTypeId: p.position_type_id,
      positionTypeCode: p.position_type_code,
      designation: p.designation,
      officeId: p.office_id,
      officeName: p.office_name,
      organizationId: p.organization_id,
      assignmentType: p.assignment_type,
    })),
    contractorIds: contractors.rows.map((c) => c.contractor_id as string),
  };
}
