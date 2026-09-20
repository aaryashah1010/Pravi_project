CREATE OR REPLACE VIEW v_current_position_holders AS
SELECT
    p.id AS position_id,
    p.position_code,
    p.office_id,
    p.position_type_id,
    u.id AS user_id,
    u.display_name,
    a.assignment_type,
    a.start_at,
    a.end_at
FROM positions p
JOIN user_position_assignments a ON a.position_id = p.id
JOIN app_users u ON u.id = a.user_id
WHERE p.status <> 'INACTIVE'
  AND a.is_active = TRUE
  AND a.start_at <= now()
  AND (a.end_at IS NULL OR a.end_at >= now())
  AND u.status = 'ACTIVE';

CREATE OR REPLACE VIEW v_project_current_workflow AS
SELECT
    wi.project_id,
    wi.id AS workflow_instance_id,
    wn.id AS workflow_node_instance_id,
    wn.node_code,
    wn.node_type,
    wn.activation_state,
    wn.execution_state,
    wn.assigned_position_id,
    wn.assigned_user_id,
    wn.blocking_reason
FROM workflow_instances wi
JOIN workflow_node_instances wn ON wn.workflow_instance_id = wi.id
WHERE wi.state IN ('ACTIVE','BLOCKED');
