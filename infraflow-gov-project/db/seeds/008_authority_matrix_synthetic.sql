-- SYNTHETIC DEMO-GOV authority matrix. NOT a real government delegation.
-- Real R&B (GJ-RNB) intentionally has NO rows here => authority resolution returns MANUAL_REVIEW.
-- Bands are inclusive on both ends, so the upper band starts at (previous max + 0.01) to avoid AMBIGUOUS at the boundary.
-- Idempotent.

INSERT INTO authority_rules (code, decision_type, department_organization_id, project_type_id, required_position_type_id,
                             routing_scope, min_cost, max_cost, priority, conditions, valid_from, rule_version_id, status)
SELECT m.code, m.decision_type, org.id, pt.id, ptype.id,
       'PROJECT_JURISDICTION', m.min_cost, m.max_cost, 100, '{}'::jsonb, DATE '2026-01-01', rv.id, 'ACTIVE'
FROM (VALUES
    ('DEMO-AA-LOW',        'ADMINISTRATIVE_APPROVAL',     'DEMO-EE', 'DEMO-AUTH-AA',         0.00::numeric,          50000000.00::numeric),
    ('DEMO-AA-HIGH',       'ADMINISTRATIVE_APPROVAL',     'DEMO-SE', 'DEMO-AUTH-AA',         50000000.01::numeric,   NULL::numeric),
    ('DEMO-TS-LOW',        'TECHNICAL_SANCTION',          'DEMO-EE', 'DEMO-AUTH-TS',         0.00::numeric,          150000000.00::numeric),
    ('DEMO-TS-HIGH',       'TECHNICAL_SANCTION',          'DEMO-SE', 'DEMO-AUTH-TS',         150000000.01::numeric,  NULL::numeric),
    ('DEMO-DTP-LOW',       'TENDER_DTP_APPROVAL',         'DEMO-EE', 'DEMO-AUTH-DTP',        0.00::numeric,          50000000.00::numeric),
    ('DEMO-DTP-HIGH',      'TENDER_DTP_APPROVAL',         'DEMO-SE', 'DEMO-AUTH-DTP',        50000000.01::numeric,   NULL::numeric),
    ('DEMO-COMPLETION',    'COMPLETION_CERTIFICATION',    'DEMO-EE', 'DEMO-AUTH-COMPLETION', NULL::numeric,          NULL::numeric)
) AS m(code, decision_type, ptype_code, rule_code, min_cost, max_cost)
JOIN organizations org ON org.code = 'DEMO-GOV'
JOIN project_types pt ON pt.code = 'GOV_BUILDING'
JOIN position_types ptype ON ptype.code = m.ptype_code
JOIN rule_versions rv ON rv.rule_code = m.rule_code AND rv.version_no = 1
ON CONFLICT (code) DO NOTHING;
