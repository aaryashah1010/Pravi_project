-- Fully synthetic demo organization hierarchy.
INSERT INTO organizations(code, name, organization_type)
VALUES
('DEMO-GOV', 'Demo Government Department', 'DEPARTMENT')
ON CONFLICT (code) DO NOTHING;

WITH dept AS (
    SELECT id FROM organizations WHERE code='DEMO-GOV'
)
INSERT INTO offices(organization_id, code, name, office_type)
SELECT id, 'DEMO-DIST-A', 'Demo District Office', 'DISTRICT'
FROM dept
ON CONFLICT (organization_id, code) DO NOTHING;

WITH dept AS (
    SELECT id FROM organizations WHERE code='DEMO-GOV'
), office AS (
    SELECT o.id FROM offices o JOIN dept d ON d.id=o.organization_id WHERE o.code='DEMO-DIST-A'
)
INSERT INTO offices(organization_id, parent_office_id, code, name, office_type)
SELECT dept.id, office.id, 'DEMO-DIV-A', 'Demo Engineering Division', 'DIVISION'
FROM dept, office
ON CONFLICT (organization_id, code) DO NOTHING;

INSERT INTO position_types(code, designation, position_category)
VALUES
('DEMO-JE','Junior Engineer','TECHNICAL'),
('DEMO-AE','Assistant Engineer','TECHNICAL'),
('DEMO-EE','Executive Engineer','TECHNICAL'),
('DEMO-SE','Superintending Engineer','TECHNICAL'),
('DEMO-OFFICER','Department Officer','ADMINISTRATIVE')
ON CONFLICT (code) DO NOTHING;
