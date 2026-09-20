-- Synthetic demo-only users. No real officer identities.
-- (Filename kept for history; projects are created by scripts/seed-scenarios.ts through the real services.)
-- Idempotent via NOT EXISTS: ON CONFLICT (external_subject) is invalid because that unique index is partial.

INSERT INTO app_users (email, display_name, phone, external_subject)
SELECT v.email, v.display_name, NULL, v.external_subject
FROM (VALUES
    ('admin@demo.infraflow.local',      'Demo System Admin',                      'demo-admin'),
    ('officer@demo.infraflow.local',    'Demo Department Officer',                'demo-officer'),
    ('engineer@demo.infraflow.local',   'Demo Assistant Engineer',                'demo-engineer'),
    ('approver@demo.infraflow.local',   'Demo Executive Engineer (Approver)',     'demo-approver'),
    ('se@demo.infraflow.local',         'Demo Superintending Engineer (Approver)','demo-se'),
    ('inspector@demo.infraflow.local',  'Demo Field Inspector (JE)',              'demo-inspector'),
    ('monitor@demo.infraflow.local',    'Demo Monitoring Officer',                'demo-monitor'),
    ('contractor@demo.infraflow.local', 'Demo Contractor User',                   'demo-contractor')
) AS v(email, display_name, external_subject)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE lower(u.email) = lower(v.email));
