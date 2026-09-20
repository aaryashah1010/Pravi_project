CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE RESTRICT,
    template_version_no INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (state IN ('DRAFT','ACTIVE','BLOCKED','COMPLETED','CANCELLED')),
    context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS workflow_node_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    node_template_id UUID NOT NULL REFERENCES workflow_node_templates(id) ON DELETE RESTRICT,
    node_code TEXT NOT NULL,
    node_type TEXT NOT NULL,
    activation_state TEXT NOT NULL DEFAULT 'INACTIVE'
        CHECK (activation_state IN ('INACTIVE','ELIGIBLE','ACTIVE','SKIPPED','NOT_APPLICABLE','BLOCKED','COMPLETED')),
    execution_state TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (execution_state IN ('PENDING','IN_PROGRESS','WAITING','COMPLETED','RETURNED','REJECTED','FAILED','CANCELLED')),
    assigned_position_type_id UUID REFERENCES position_types(id) ON DELETE RESTRICT,
    assigned_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    assigned_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    source_rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    blocking_reason JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workflow_instance_id, node_code)
);

ALTER TABLE authority_resolutions
    ADD CONSTRAINT fk_authority_resolution_node
    FOREIGN KEY (workflow_node_instance_id)
    REFERENCES workflow_node_instances(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS workflow_instance_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    from_node_instance_id UUID NOT NULL REFERENCES workflow_node_instances(id) ON DELETE CASCADE,
    to_node_instance_id UUID NOT NULL REFERENCES workflow_node_instances(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL
        CHECK (dependency_type IN ('BLOCKING','REQUIRES_COMPLETION','INFORMATIONAL','PARALLEL','CONDITIONAL')),
    condition JSONB NOT NULL DEFAULT '{}'::jsonb,
    state TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (state IN ('ACTIVE','SATISFIED','WAIVED','DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workflow_instance_id, from_node_instance_id, to_node_instance_id, dependency_type),
    CHECK (from_node_instance_id <> to_node_instance_id)
);

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_node_instance_id UUID NOT NULL REFERENCES workflow_node_instances(id) ON DELETE CASCADE,
    from_activation_state TEXT,
    to_activation_state TEXT,
    from_execution_state TEXT,
    to_execution_state TEXT,
    actor_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_node_instance_id UUID REFERENCES workflow_node_instances(id) ON DELETE SET NULL,
    task_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED','BLOCKED','OVERDUE')),
    assigned_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    assigned_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    source_rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    due_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version_no BIGINT NOT NULL DEFAULT 1 CHECK (version_no > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (assigned_user_id IS NOT NULL OR assigned_position_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tasks_open_by_user ON tasks(assigned_user_id, due_at)
WHERE status IN ('PENDING','IN_PROGRESS','OVERDUE');
CREATE INDEX IF NOT EXISTS idx_tasks_open_by_position ON tasks(assigned_position_id, due_at)
WHERE status IN ('PENDING','IN_PROGRESS','OVERDUE');
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_active
ON workflow_node_instances(workflow_instance_id, activation_state, execution_state);
