-- Find workflow nodes that are blocked because they depend on incomplete upstream nodes.
SELECT
    wi.project_id,
    down.id AS blocked_node_id,
    down.node_code AS blocked_node,
    up.id AS blocker_node_id,
    up.node_code AS blocker_node,
    up.execution_state AS blocker_state,
    dep.dependency_type
FROM workflow_instance_dependencies dep
JOIN workflow_instances wi ON wi.id = dep.workflow_instance_id
JOIN workflow_node_instances up ON up.id = dep.from_node_instance_id
JOIN workflow_node_instances down ON down.id = dep.to_node_instance_id
WHERE dep.state = 'ACTIVE'
  AND dep.dependency_type IN ('BLOCKING','REQUIRES_COMPLETION')
  AND up.execution_state <> 'COMPLETED';

-- Recursive downstream impact from a nominated blocker.
WITH RECURSIVE downstream AS (
    SELECT
        dep.to_node_instance_id AS node_id,
        1 AS depth
    FROM workflow_instance_dependencies dep
    WHERE dep.from_node_instance_id = $1
      AND dep.state = 'ACTIVE'
      AND dep.dependency_type IN ('BLOCKING','REQUIRES_COMPLETION')

    UNION ALL

    SELECT
        dep.to_node_instance_id,
        d.depth + 1
    FROM downstream d
    JOIN workflow_instance_dependencies dep
      ON dep.from_node_instance_id = d.node_id
    WHERE dep.state = 'ACTIVE'
      AND dep.dependency_type IN ('BLOCKING','REQUIRES_COMPLETION')
      AND d.depth < 50
)
SELECT
    COUNT(*) AS downstream_blocked_count,
    MAX(depth) AS deepest_dependency_depth
FROM downstream;
