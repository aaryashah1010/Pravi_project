-- Workflow template GOV_BUILDING_STD v1 (19 nodes, 22 edges).
-- Structure only. Legal force comes solely from each node's linked rule_version (NULL rule = "configured prerequisite").
-- config.sla_days are CONFIGURED SLAs, not statutory. Idempotent.

INSERT INTO workflow_templates (code, name, version_no, project_type_id, department_organization_id, generation_mode, status)
SELECT 'GOV_BUILDING_STD', 'Government Building - Standard Lifecycle (configured template)', 1, pt.id, NULL, 'HYBRID', 'ACTIVE'
FROM project_types pt WHERE pt.code = 'GOV_BUILDING'
ON CONFLICT (code, version_no) DO NOTHING;

-- Nodes ----------------------------------------------------------------------------
INSERT INTO workflow_node_templates (workflow_template_id, node_code, name, node_type, required_by_default,
                                     activation_condition, assigned_position_type_id, rule_version_id, config)
SELECT t.id, m.node_code, m.name, m.node_type, TRUE, m.cond::jsonb, ptype.id, rv.id, m.config::jsonb
FROM (VALUES
 ('PROPOSAL',            'Project proposal with cost estimate',              'TASK',        'DEMO-OFFICER', 'RULE-001',    $j${}$j$, $j${"sla_days":3,"lifecycle_stage":"PROPOSAL"}$j$),
 ('BUDGET_PROVISION',    'Budget provision and fund availability check',     'DOCUMENT',    'DEMO-OFFICER', 'RNB-WF-001',  $j${}$j$, $j${"sla_days":5,"lifecycle_stage":"FUNDING"}$j$),
 ('SITE_HANDOVER',       'Site readiness and land made over',                'TASK',        'DEMO-OFFICER', 'RULE-007',    $j${}$j$, $j${"sla_days":3,"lifecycle_stage":"SITE_READINESS","on_complete":{"site_possession_status":"HANDED_OVER"}}$j$),
 ('ADMIN_APPROVAL',      'Administrative Approval',                          'APPROVAL',    NULL,           'RNB-WF-002',  $j${}$j$, $j${"decision_type":"ADMINISTRATIVE_APPROVAL","submitter_position_type":"DEMO-OFFICER","sla_days":7,"lifecycle_stage":"ADMINISTRATIVE_APPROVAL"}$j$),
 ('DESIGN_ESTIMATE',     'Detailed design and estimate',                     'DOCUMENT',    'DEMO-AE',      'RNB-WF-003',  $j${}$j$, $j${"sla_days":10,"lifecycle_stage":"DESIGN"}$j$),
 ('TECHNICAL_SANCTION',  'Technical Sanction',                               'APPROVAL',    NULL,           'RNB-TS-001',  $j${}$j$, $j${"decision_type":"TECHNICAL_SANCTION","submitter_position_type":"DEMO-AE","sla_days":7,"lifecycle_stage":"TECHNICAL_SANCTION"}$j$),
 ('FUND_ALLOTMENT',      'Fund allotment',                                   'TASK',        'DEMO-OFFICER', 'RNB-WF-001',  $j${}$j$, $j${"sla_days":5,"lifecycle_stage":"FUNDING"}$j$),
 ('LOCAL_BODY_CLEARANCE','Local-body approval (conditional)',                'CLEARANCE',   'DEMO-OFFICER', 'RNB-BLD-002',
     $j${"all":[{"fact":"attributes.local_body_approval_required","op":"eq","value":true}]}$j$,
     $j${"sla_days":14,"lifecycle_stage":"CLEARANCES","clearance_type":"LOCAL_BODY_APPROVAL"}$j$),
 ('TENDER_DTP_APPROVAL', 'Draft Tender Paper approval',                      'APPROVAL',    NULL,           'RNB-TND-001', $j${}$j$, $j${"decision_type":"TENDER_DTP_APPROVAL","submitter_position_type":"DEMO-OFFICER","sla_days":5,"lifecycle_stage":"PROCUREMENT"}$j$),
 ('TENDER',              'Tender / procurement (external e-procurement reference)', 'TASK', 'DEMO-OFFICER', 'RNB-TND-002', $j${}$j$, $j${"sla_days":30,"lifecycle_stage":"PROCUREMENT"}$j$),
 ('CONTRACT',            'Contract award and contract documents',            'TASK',        'DEMO-OFFICER', 'RNB-CNT-001', $j${}$j$, $j${"sla_days":10,"lifecycle_stage":"CONTRACT"}$j$),
 ('WORK_ORDER',          'Work order issue',                                 'TASK',        'DEMO-EE',      NULL,          $j${}$j$, $j${"sla_days":3,"lifecycle_stage":"WORK_ORDER"}$j$),
 ('CONSTRUCTION_START',  'Construction start gate (pre-commencement conditions)', 'GATE',  NULL,           'RNB-WF-001',  $j${}$j$, $j${"auto_complete":true,"lifecycle_stage":"CONSTRUCTION"}$j$),
 ('EXEC_FOUNDATION',     'Foundation and plinth',                            'MILESTONE',   'DEMO-JE',      'RULE-004',    $j${}$j$, $j${"milestone_code":"M1","milestone_name":"Foundation and plinth","lifecycle_stage":"CONSTRUCTION","sla_days":45}$j$),
 ('EXEC_SUPERSTRUCTURE', 'Superstructure',                                   'MILESTONE',   'DEMO-JE',      'RULE-004',    $j${}$j$, $j${"milestone_code":"M2","milestone_name":"Superstructure","lifecycle_stage":"CONSTRUCTION","sla_days":60}$j$),
 ('EXEC_FINISHING',      'Finishing and services',                           'MILESTONE',   'DEMO-JE',      'RULE-004',    $j${}$j$, $j${"milestone_code":"M3","milestone_name":"Finishing and services","lifecycle_stage":"CONSTRUCTION","sla_days":45}$j$),
 ('COMPLETION',          'Completion certification',                         'APPROVAL',    NULL,           NULL,          $j${}$j$, $j${"decision_type":"COMPLETION_CERTIFICATION","submitter_position_type":"DEMO-AE","sla_days":7,"lifecycle_stage":"COMPLETION"}$j$),
 ('HANDOVER',            'Handover to receiving office',                     'TASK',        'DEMO-OFFICER', NULL,          $j${}$j$, $j${"sla_days":10,"lifecycle_stage":"HANDOVER"}$j$),
 ('DLP',                 'Defect liability period (contract-specific)',      'INFORMATION', NULL,           'RULE-012',    $j${}$j$, $j${"lifecycle_stage":"DLP"}$j$)
) AS m(node_code, name, node_type, ptype_code, rule_code, cond, config)
JOIN workflow_templates t ON t.code = 'GOV_BUILDING_STD' AND t.version_no = 1
LEFT JOIN position_types ptype ON ptype.code = m.ptype_code
LEFT JOIN rule_versions rv ON rv.rule_code = m.rule_code AND rv.version_no = 1
ON CONFLICT (workflow_template_id, node_code) DO NOTHING;

-- Edges ----------------------------------------------------------------------------
INSERT INTO workflow_edge_templates (workflow_template_id, from_node_template_id, to_node_template_id, dependency_type, condition)
SELECT t.id, f.id, o.id, m.dep_type, m.cond::jsonb
FROM (VALUES
 ('PROPOSAL',            'BUDGET_PROVISION',     'REQUIRES_COMPLETION', $j${}$j$),
 ('PROPOSAL',            'SITE_HANDOVER',        'REQUIRES_COMPLETION', $j${}$j$),
 ('BUDGET_PROVISION',    'ADMIN_APPROVAL',       'BLOCKING',            $j${}$j$),
 ('ADMIN_APPROVAL',      'DESIGN_ESTIMATE',      'BLOCKING',            $j${}$j$),
 ('DESIGN_ESTIMATE',     'TECHNICAL_SANCTION',   'BLOCKING',            $j${}$j$),
 ('TECHNICAL_SANCTION',  'FUND_ALLOTMENT',       'REQUIRES_COMPLETION', $j${}$j$),
 ('TECHNICAL_SANCTION',  'LOCAL_BODY_CLEARANCE', 'REQUIRES_COMPLETION', $j${}$j$),
 ('TECHNICAL_SANCTION',  'TENDER_DTP_APPROVAL',  'BLOCKING',            $j${}$j$),
 ('TENDER_DTP_APPROVAL', 'TENDER',               'BLOCKING',            $j${}$j$),
 ('TENDER',              'CONTRACT',             'BLOCKING',            $j${}$j$),
 ('LOCAL_BODY_CLEARANCE','CONTRACT',             'CONDITIONAL',         $j${"applies_when_source_applicable":true}$j$),
 ('CONTRACT',            'WORK_ORDER',           'BLOCKING',            $j${}$j$),
 ('FUND_ALLOTMENT',      'WORK_ORDER',           'REQUIRES_COMPLETION', $j${}$j$),
 ('WORK_ORDER',          'CONSTRUCTION_START',   'BLOCKING',            $j${}$j$),
 ('SITE_HANDOVER',       'CONSTRUCTION_START',   'BLOCKING',            $j${}$j$),
 ('TECHNICAL_SANCTION',  'CONSTRUCTION_START',   'BLOCKING',            $j${}$j$),
 ('CONSTRUCTION_START',  'EXEC_FOUNDATION',      'BLOCKING',            $j${}$j$),
 ('EXEC_FOUNDATION',     'EXEC_SUPERSTRUCTURE',  'BLOCKING',            $j${}$j$),
 ('EXEC_SUPERSTRUCTURE', 'EXEC_FINISHING',       'BLOCKING',            $j${}$j$),
 ('EXEC_FINISHING',      'COMPLETION',           'BLOCKING',            $j${}$j$),
 ('COMPLETION',          'HANDOVER',             'BLOCKING',            $j${}$j$),
 ('HANDOVER',            'DLP',                  'REQUIRES_COMPLETION', $j${}$j$)
) AS m(from_code, to_code, dep_type, cond)
JOIN workflow_templates t ON t.code = 'GOV_BUILDING_STD' AND t.version_no = 1
JOIN workflow_node_templates f ON f.workflow_template_id = t.id AND f.node_code = m.from_code
JOIN workflow_node_templates o ON o.workflow_template_id = t.id AND o.node_code = m.to_code
ON CONFLICT (workflow_template_id, from_node_template_id, to_node_template_id, dependency_type) DO NOTHING;

-- Required documents (configured; legal force only where the node's rule says so) -------------
INSERT INTO workflow_required_documents (node_template_id, document_type_id, required)
SELECT n.id, dt.id, TRUE
FROM (VALUES
 ('BUDGET_PROVISION',     'BUDGET_PROVISION'),
 ('SITE_HANDOVER',        'LAND_RECORD'),
 ('SITE_HANDOVER',        'HANDOVER_RECORD'),
 ('ADMIN_APPROVAL',       'DPR'),
 ('DESIGN_ESTIMATE',      'DRAWING'),
 ('DESIGN_ESTIMATE',      'ESTIMATE'),
 ('TECHNICAL_SANCTION',   'TECHNICAL_NOTE'),
 ('LOCAL_BODY_CLEARANCE', 'CLEARANCE_CERTIFICATE'),
 ('TENDER_DTP_APPROVAL',  'TENDER_DOCUMENT'),
 ('COMPLETION',           'COMPLETION_CERTIFICATE')
) AS m(node_code, doc_code)
JOIN workflow_templates t ON t.code = 'GOV_BUILDING_STD' AND t.version_no = 1
JOIN workflow_node_templates n ON n.workflow_template_id = t.id AND n.node_code = m.node_code
JOIN document_types dt ON dt.code = m.doc_code
ON CONFLICT (node_template_id, document_type_id) DO NOTHING;
