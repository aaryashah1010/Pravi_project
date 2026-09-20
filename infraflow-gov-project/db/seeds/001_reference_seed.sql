-- Synthetic seed data for development only.
-- No real government officer identities are used.

INSERT INTO project_types(code, name, description)
VALUES
('GOV_BUILDING', 'Government Building', 'Prototype scope: Gujarat public-works/government-building scenario'),
('ROAD', 'Road', 'Future rule package placeholder'),
('BRIDGE', 'Bridge', 'Future rule package placeholder')
ON CONFLICT (code) DO NOTHING;

INSERT INTO document_types(code, name, category)
VALUES
('DPR', 'Detailed Project Report', 'PROJECT'),
('DRAWING', 'Drawing / Plan', 'TECHNICAL'),
('ESTIMATE', 'Detailed Estimate', 'TECHNICAL'),
('LAND_RECORD', 'Land / Site Record', 'SITE'),
('TECHNICAL_NOTE', 'Technical Note', 'TECHNICAL'),
('INSPECTION_REPORT', 'Inspection Report', 'INSPECTION'),
('MEASUREMENT_RECORD', 'Measurement Record', 'MEASUREMENT'),
('COMPLETION_CERTIFICATE', 'Completion Certificate', 'COMPLETION')
ON CONFLICT (code) DO NOTHING;

INSERT INTO funding_sources(code, name, source_type)
VALUES
('STATE_BUDGET', 'State Budget', 'BUDGET'),
('CENTRAL_ASSISTANCE', 'Central Assistance', 'GRANT'),
('OTHER', 'Other', 'OTHER')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles(code, name, description)
VALUES
('SYSTEM_ADMIN', 'System Administrator', 'Platform configuration and governance'),
('DEPARTMENT_OFFICER', 'Department Officer', 'Project initiation and departmental workflow'),
('TECHNICAL_OFFICER', 'Technical Officer', 'Technical review and field activities'),
('APPROVING_AUTHORITY', 'Approving Authority', 'Decision authority according to configured powers'),
('MONITORING_OFFICER', 'Monitoring Officer', 'Portfolio and control-tower monitoring'),
('FIELD_INSPECTOR', 'Field Inspector', 'Site inspection and evidence capture'),
('CONTRACTOR', 'Contractor', 'External project execution participant')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, description)
VALUES
('project.create','Create a project'),
('project.read','Read project data'),
('project.update','Update project data within scope'),
('approval.review','Review an assigned approval'),
('approval.decide','Make an authorized approval decision'),
('workflow.manage','Manage workflow definitions'),
('rule.manage','Manage rule registry'),
('inspection.create','Create an inspection'),
('inspection.submit','Submit inspection results'),
('contractor.submit_progress','Submit contractor progress'),
('audit.read','Read audit logs'),
('dashboard.read','Read operational dashboards')
ON CONFLICT (code) DO NOTHING;
