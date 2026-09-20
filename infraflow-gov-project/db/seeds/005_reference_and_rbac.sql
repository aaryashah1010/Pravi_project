-- Additional reference data + complete role/permission matrix. Idempotent.

INSERT INTO document_types (code, name, category) VALUES
    ('BUDGET_PROVISION',      'Budget Provision Evidence',        'FINANCE'),
    ('HANDOVER_RECORD',       'Site Handover Record',             'SITE'),
    ('SITE_PHOTO',            'Site Photograph',                  'INSPECTION'),
    ('TENDER_DOCUMENT',       'Tender Document',                  'PROCUREMENT'),
    ('WORK_ORDER_DOC',        'Work Order Document',              'CONTRACT'),
    ('CLEARANCE_CERTIFICATE', 'Clearance / Permission Certificate','CLEARANCE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO position_types (code, designation, position_category) VALUES
    ('DEMO-MONITOR', 'Monitoring Officer', 'ADMINISTRATIVE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
    ('document.upload',          'Upload project documents and evidence'),
    ('document.verify',          'Verify or reject submitted documents'),
    ('issue.manage',             'Raise and resolve issues / hindrances'),
    ('milestone.update',         'Update milestone progress'),
    ('ai.use',                   'Use the advisory AI copilot'),
    ('authority.manual_assign',  'Manually assign an approver when authority cannot be resolved')
ON CONFLICT (code) DO NOTHING;

-- role -> permissions (SYSTEM_ADMIN gets everything)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'SYSTEM_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    ('DEPARTMENT_OFFICER',  'project.create'),
    ('DEPARTMENT_OFFICER',  'project.read'),
    ('DEPARTMENT_OFFICER',  'project.update'),
    ('DEPARTMENT_OFFICER',  'dashboard.read'),
    ('DEPARTMENT_OFFICER',  'approval.review'),
    ('DEPARTMENT_OFFICER',  'document.upload'),
    ('DEPARTMENT_OFFICER',  'issue.manage'),
    ('DEPARTMENT_OFFICER',  'ai.use'),

    ('TECHNICAL_OFFICER',   'project.read'),
    ('TECHNICAL_OFFICER',   'project.update'),
    ('TECHNICAL_OFFICER',   'dashboard.read'),
    ('TECHNICAL_OFFICER',   'approval.review'),
    ('TECHNICAL_OFFICER',   'inspection.create'),
    ('TECHNICAL_OFFICER',   'inspection.submit'),
    ('TECHNICAL_OFFICER',   'document.upload'),
    ('TECHNICAL_OFFICER',   'document.verify'),
    ('TECHNICAL_OFFICER',   'milestone.update'),
    ('TECHNICAL_OFFICER',   'issue.manage'),
    ('TECHNICAL_OFFICER',   'ai.use'),

    ('APPROVING_AUTHORITY', 'project.read'),
    ('APPROVING_AUTHORITY', 'approval.review'),
    ('APPROVING_AUTHORITY', 'approval.decide'),
    ('APPROVING_AUTHORITY', 'document.verify'),
    ('APPROVING_AUTHORITY', 'dashboard.read'),
    ('APPROVING_AUTHORITY', 'audit.read'),
    ('APPROVING_AUTHORITY', 'ai.use'),

    ('MONITORING_OFFICER',  'project.read'),
    ('MONITORING_OFFICER',  'dashboard.read'),
    ('MONITORING_OFFICER',  'audit.read'),
    ('MONITORING_OFFICER',  'issue.manage'),
    ('MONITORING_OFFICER',  'ai.use'),

    ('FIELD_INSPECTOR',     'project.read'),
    ('FIELD_INSPECTOR',     'inspection.create'),
    ('FIELD_INSPECTOR',     'inspection.submit'),
    ('FIELD_INSPECTOR',     'document.upload'),
    ('FIELD_INSPECTOR',     'issue.manage'),

    ('CONTRACTOR',          'project.read'),
    ('CONTRACTOR',          'contractor.submit_progress'),
    ('CONTRACTOR',          'document.upload'),
    ('CONTRACTOR',          'issue.manage')
) AS m(role_code, perm_code)
JOIN roles r ON r.code = m.role_code
JOIN permissions p ON p.code = m.perm_code
ON CONFLICT DO NOTHING;
