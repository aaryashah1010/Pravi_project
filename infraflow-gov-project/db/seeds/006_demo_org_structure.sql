-- Synthetic jurisdictions, offices, positions, position holders, role scopes, contractor.
-- DEMO-GOV = synthetic department that has a (synthetic) delegation matrix.
-- GJ-RNB   = real department name used ONLY to demonstrate "no verified delegation => manual review".
-- Idempotent.

-- Jurisdictions ------------------------------------------------------------
INSERT INTO jurisdictions (code, name, jurisdiction_type) VALUES ('DEMO-GUJARAT', 'Demo State', 'STATE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO jurisdictions (code, name, jurisdiction_type, parent_jurisdiction_id)
SELECT 'DEMO-AHMEDABAD', 'Demo Ahmedabad District', 'DISTRICT', j.id FROM jurisdictions j WHERE j.code = 'DEMO-GUJARAT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO jurisdictions (code, name, jurisdiction_type, parent_jurisdiction_id)
SELECT 'DEMO-TALUKA-01', 'Demo Taluka 01', 'TALUKA', j.id FROM jurisdictions j WHERE j.code = 'DEMO-AHMEDABAD'
ON CONFLICT (code) DO NOTHING;

-- Real R&B department (no delegation configured) with a synthetic division office --------------
INSERT INTO organizations (code, name, organization_type) VALUES
    ('GJ-RNB', 'Roads & Buildings Department (prototype: no verified delegation configured)', 'DEPARTMENT')
ON CONFLICT (code) DO NOTHING;

INSERT INTO offices (organization_id, code, name, office_type)
SELECT o.id, 'RNB-DEMO-DIV', 'R&B Demo Division Office (synthetic)', 'DIVISION'
FROM organizations o WHERE o.code = 'GJ-RNB'
ON CONFLICT (organization_id, code) DO NOTHING;

-- Office coverage --------------------------------------------------------------
INSERT INTO office_jurisdictions (office_id, jurisdiction_id, coverage_type)
SELECT o.id, j.id, 'PRIMARY'
FROM (VALUES
    ('DEMO-GOV', 'DEMO-DIST-A',   'DEMO-AHMEDABAD'),
    ('DEMO-GOV', 'DEMO-DIV-A',    'DEMO-TALUKA-01'),
    ('GJ-RNB',   'RNB-DEMO-DIV',  'DEMO-AHMEDABAD')
) AS m(org_code, office_code, jur_code)
JOIN organizations org ON org.code = m.org_code
JOIN offices o ON o.organization_id = org.id AND o.code = m.office_code
JOIN jurisdictions j ON j.code = m.jur_code
ON CONFLICT DO NOTHING;

-- Positions (a position is a seat; people hold it) ---------------------------------
INSERT INTO positions (office_id, position_type_id, position_code, display_name)
SELECT o.id, pt.id, m.position_code, m.display_name
FROM (VALUES
    ('DEMO-GOV', 'DEMO-DIST-A',  'DEMO-OFFICER', 'DIST-OFFICER-01', 'District Department Officer'),
    ('DEMO-GOV', 'DEMO-DIST-A',  'DEMO-SE',      'DIST-SE-01',      'Superintending Engineer, District'),
    ('DEMO-GOV', 'DEMO-DIST-A',  'DEMO-MONITOR', 'DIST-MON-01',     'Monitoring Officer, District'),
    ('DEMO-GOV', 'DEMO-DIV-A',   'DEMO-AE',      'DIV-AE-01',       'Assistant Engineer, Division'),
    ('DEMO-GOV', 'DEMO-DIV-A',   'DEMO-EE',      'DIV-EE-01',       'Executive Engineer, Division'),
    ('DEMO-GOV', 'DEMO-DIV-A',   'DEMO-JE',      'DIV-JE-01',       'Junior Engineer / Field Inspector, Division'),
    ('GJ-RNB',   'RNB-DEMO-DIV', 'DEMO-OFFICER', 'RNB-OFFICER-01',  'R&B Division Officer (vacant seat)'),
    ('GJ-RNB',   'RNB-DEMO-DIV', 'DEMO-EE',      'RNB-EE-01',       'R&B Executive Engineer (vacant seat)')
) AS m(org_code, office_code, ptype_code, position_code, display_name)
JOIN organizations org ON org.code = m.org_code
JOIN offices o ON o.organization_id = org.id AND o.code = m.office_code
JOIN position_types pt ON pt.code = m.ptype_code
ON CONFLICT (office_id, position_code) DO NOTHING;

-- Position holders (RNB seats intentionally have no holder) ---------------------------
INSERT INTO user_position_assignments (user_id, position_id, assignment_type, start_at)
SELECT u.id, p.id, 'PRIMARY', TIMESTAMPTZ '2026-01-01 00:00:00+00'
FROM (VALUES
    ('officer@demo.infraflow.local',   'DEMO-DIST-A', 'DIST-OFFICER-01'),
    ('se@demo.infraflow.local',        'DEMO-DIST-A', 'DIST-SE-01'),
    ('monitor@demo.infraflow.local',   'DEMO-DIST-A', 'DIST-MON-01'),
    ('engineer@demo.infraflow.local',  'DEMO-DIV-A',  'DIV-AE-01'),
    ('approver@demo.infraflow.local',  'DEMO-DIV-A',  'DIV-EE-01'),
    ('inspector@demo.infraflow.local', 'DEMO-DIV-A',  'DIV-JE-01')
) AS m(email, office_code, position_code)
JOIN app_users u ON lower(u.email) = m.email
JOIN organizations org ON org.code = 'DEMO-GOV'
JOIN offices o ON o.organization_id = org.id AND o.code = m.office_code
JOIN positions p ON p.office_id = o.id AND p.position_code = m.position_code
WHERE NOT EXISTS (
    SELECT 1 FROM user_position_assignments a
    WHERE a.user_id = u.id AND a.position_id = p.id AND a.is_active = TRUE AND a.end_at IS NULL
);

-- Role scopes (NULL org = global) ------------------------------------------------------
INSERT INTO user_role_assignments (user_id, role_id, organization_id)
SELECT u.id, r.id, org.id
FROM (VALUES
    ('admin@demo.infraflow.local',      'SYSTEM_ADMIN',        NULL),
    ('officer@demo.infraflow.local',    'DEPARTMENT_OFFICER',  'DEMO-GOV'),
    ('engineer@demo.infraflow.local',   'TECHNICAL_OFFICER',   'DEMO-GOV'),
    ('approver@demo.infraflow.local',   'APPROVING_AUTHORITY', 'DEMO-GOV'),
    ('se@demo.infraflow.local',         'APPROVING_AUTHORITY', 'DEMO-GOV'),
    ('inspector@demo.infraflow.local',  'FIELD_INSPECTOR',     'DEMO-GOV'),
    ('monitor@demo.infraflow.local',    'MONITORING_OFFICER',  NULL),
    ('contractor@demo.infraflow.local', 'CONTRACTOR',          NULL)
) AS m(email, role_code, org_code)
JOIN app_users u ON lower(u.email) = m.email
JOIN roles r ON r.code = m.role_code
LEFT JOIN organizations org ON org.code = m.org_code
WHERE NOT EXISTS (
    SELECT 1 FROM user_role_assignments a
    WHERE a.user_id = u.id AND a.role_id = r.id AND a.organization_id IS NOT DISTINCT FROM org.id AND a.is_active = TRUE
);

-- Contractor (synthetic) and its user --------------------------------------------------
INSERT INTO contractors (code, legal_name, metadata)
VALUES ('DEMO-CTR-01', 'Demo Construction Co. (synthetic)', '{"synthetic": true}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO contractor_users (contractor_id, user_id)
SELECT c.id, u.id
FROM contractors c JOIN app_users u ON lower(u.email) = 'contractor@demo.infraflow.local'
WHERE c.code = 'DEMO-CTR-01'
ON CONFLICT DO NOTHING;
