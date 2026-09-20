import type { Queryable } from '../../platform/db.js';
import { notFound } from '../../platform/errors.js';
import * as repo from './rules.repo.js';
import { deriveTrustBadge, isExecutable } from './domain/rule-status.js';

export function toRuleDto(r: repo.RuleRow, at: Date = new Date()) {
  return {
    id: r.id,
    ruleCode: r.rule_code,
    versionNo: r.version_no,
    name: r.rule_name,
    category: r.rule_category,
    statement: (r.action?.statement as string | undefined) ?? null,
    note: (r.action?.note as string | undefined) ?? null,
    scope: r.scope,
    conditions: r.conditions,
    enforcementMode: r.enforcement_mode,
    verificationStatus: r.verification_status,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    executable: isExecutable(r, at),
    trustBadge: deriveTrustBadge(r, at),
    synthetic: r.scope?.synthetic === true,
    source: {
      id: r.source_id,
      code: r.source_code,
      title: r.source_title,
      issuingAuthority: r.issuing_authority,
      type: r.source_type,
      verificationLevel: r.verification_level,
      officialUrl: r.official_url,
      notes: r.source_notes,
    },
  };
}

export type RuleDto = ReturnType<typeof toRuleDto>;

export async function listRules(db: Queryable, f: { category?: string; verification?: string; q?: string }) {
  const rows = await repo.listRules(db, f);
  return rows.map((r) => toRuleDto(r));
}

export async function getProvenance(db: Queryable, id: string) {
  const rule = await repo.getRuleById(db, id);
  if (!rule) throw notFound('Rule');
  const [citations, usage] = await Promise.all([repo.listCitations(db, id), repo.listUsage(db, id)]);
  return {
    rule: toRuleDto(rule),
    citations: citations.length
      ? citations.map((c) => ({ type: c.citation_type, locator: c.locator, pageStart: c.page_start, pageEnd: c.page_end, notes: c.notes }))
      : [{ type: 'OTHER', locator: 'Citation locator to be captured', pageStart: null, pageEnd: null, notes: null }],
    usage: {
      workflowNodes: usage.nodes.map((n) => ({ templateCode: n.template_code, nodeCode: n.node_code, name: n.node_name, nodeType: n.node_type })),
      authorityRules: usage.authorityRules.map((a) => ({
        code: a.code,
        decisionType: a.decision_type,
        minCost: a.min_cost,
        maxCost: a.max_cost,
        requiredPosition: a.position_type,
      })),
    },
  };
}
