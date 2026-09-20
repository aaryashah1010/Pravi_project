-- Nodes ready to activate: all blocking/requires-completion predecessors are satisfied.
SELECT n.*
FROM workflow_node_instances n
WHERE n.activation_state = 'ELIGIBLE'
  AND NOT EXISTS (
      SELECT 1
      FROM workflow_instance_dependencies d
      JOIN workflow_node_instances predecessor
        ON predecessor.id = d.from_node_instance_id
      WHERE d.to_node_instance_id = n.id
        AND d.state = 'ACTIVE'
        AND d.dependency_type IN ('BLOCKING','REQUIRES_COMPLETION')
        AND predecessor.execution_state <> 'COMPLETED'
  );

-- Nodes that can proceed in parallel because no blocking dependency exists.
SELECT n.*
FROM workflow_node_instances n
WHERE n.activation_state = 'ELIGIBLE'
  AND NOT EXISTS (
      SELECT 1
      FROM workflow_instance_dependencies d
      WHERE d.to_node_instance_id = n.id
        AND d.state = 'ACTIVE'
        AND d.dependency_type IN ('BLOCKING','REQUIRES_COMPLETION')
  );
