import type { Queryable } from '../../platform/db.js';

export interface RuleRow {
  id: string;
  rule_code: string;
  version_no: number;
  rule_name: string;
  rule_category: string;
  scope: Record<string, unknown>;
  conditions: Record<string, unknown>;
  action: Record<string, unknown>;
  enforcement_mode: 'ENFORCEABLE' | 'ADVISORY_ONLY' | 'NON_ENFORCEABLE';
  verification_status: 'DRAFT' | 'VERIFIED' | 'UNVERIFIED' | 'SUPERSEDED' | 'DISABLED';
  effective_from: string | null;
  effective_to: string | null;
  verified_at: Date | null;
  source_id: string;
  source_code: string;
  source_title: string;
  issuing_authority: string;
  source_type: string;
  verification_level: string;
  official_url: string | null;
  source_notes: string | null;
  source_effective_from: string | null;
  source_effective_to: string | null;
}

const RULE_SELECT = `
  SELECT rv.id, rv.rule_code, rv.version_no, rv.rule_name, rv.rule_category, rv.scope, rv.conditions, rv.action,
         rv.enforcement_mode, rv.verification_status, rv.effective_from, rv.effective_to, rv.verified_at,
         rs.id AS source_id, rs.source_code, rs.title AS source_title, rs.issuing_authority, rs.source_type,
         rs.verification_level, rs.official_url, rs.notes AS source_notes,
         rs.effective_from AS source_effective_from, rs.effective_to AS source_effective_to
    FROM rule_versions rv
    JOIN rule_sources rs ON rs.id = rv.source_id`;

export async function listRules(db: Queryable, f: { category?: string; verification?: string; q?: string }): Promise<RuleRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.category) {
    params.push(f.category);
    where.push(`rv.rule_category = $${params.length}`);
  }
  if (f.verification) {
    params.push(f.verification);
    where.push(`rv.verification_status = $${params.length}`);
  }
  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`(rv.rule_code ILIKE $${params.length} OR rv.rule_name ILIKE $${params.length})`);
  }
  const r = await db.query<RuleRow>(
    `${RULE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY rv.rule_code, rv.version_no`,
    params,
  );
  return r.rows;
}

export async function getRuleById(db: Queryable, id: string): Promise<RuleRow | null> {
  const r = await db.query<RuleRow>(`${RULE_SELECT} WHERE rv.id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function getRulesByIds(db: Queryable, ids: string[]): Promise<RuleRow[]> {
  if (!ids.length) return [];
  const r = await db.query<RuleRow>(`${RULE_SELECT} WHERE rv.id = ANY($1::uuid[])`, [ids]);
  return r.rows;
}

export interface CitationRow {
  citation_type: string;
  locator: string;
  page_start: number | null;
  page_end: number | null;
  notes: string | null;
}

export async function listCitations(db: Queryable, ruleVersionId: string): Promise<CitationRow[]> {
  const r = await db.query<CitationRow>(
    `SELECT citation_type, locator, page_start, page_end, notes FROM rule_citations WHERE rule_version_id = $1 ORDER BY created_at`,
    [ruleVersionId],
  );
  return r.rows;
}

export async function listUsage(db: Queryable, ruleVersionId: string) {
  const [nodes, authority] = await Promise.all([
    db.query<{ template_code: string; node_code: string; node_name: string; node_type: string }>(
      `SELECT t.code AS template_code, n.node_code, n.name AS node_name, n.node_type
         FROM workflow_node_templates n JOIN workflow_templates t ON t.id = n.workflow_template_id
        WHERE n.rule_version_id = $1 ORDER BY t.code, n.node_code`,
      [ruleVersionId],
    ),
    db.query<{ code: string; decision_type: string; min_cost: string | null; max_cost: string | null; position_type: string }>(
      `SELECT ar.code, ar.decision_type, ar.min_cost, ar.max_cost, pt.designation AS position_type
         FROM authority_rules ar JOIN position_types pt ON pt.id = ar.required_position_type_id
        WHERE ar.rule_version_id = $1 ORDER BY ar.code`,
      [ruleVersionId],
    ),
  ]);
  return { nodes: nodes.rows, authorityRules: authority.rows };
}
