CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','BLOCKED','RESOLVED','CLOSED','CANCELLED')),
    owner_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    owner_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    impact JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_workflow_links (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    workflow_node_instance_id UUID NOT NULL REFERENCES workflow_node_instances(id) ON DELETE CASCADE,
    impact_type TEXT NOT NULL DEFAULT 'BLOCKS'
        CHECK (impact_type IN ('BLOCKS','AFFECTS','INFORMS')),
    PRIMARY KEY (issue_id, workflow_node_instance_id)
);

CREATE TABLE IF NOT EXISTS issue_milestone_links (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    impact_type TEXT NOT NULL DEFAULT 'AFFECTS'
        CHECK (impact_type IN ('BLOCKS','AFFECTS','INFORMS')),
    PRIMARY KEY (issue_id, milestone_id)
);

CREATE TABLE IF NOT EXISTS variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    variation_number TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    original_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposed_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_impact NUMERIC(18,2) NOT NULL DEFAULT 0,
    time_impact_days INTEGER NOT NULL DEFAULT 0,
    technical_impact TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN','SUPERSEDED')),
    requires_reapproval BOOLEAN NOT NULL DEFAULT FALSE,
    source_rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    requested_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variation_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variation_id UUID NOT NULL REFERENCES variations(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('SUBMIT','APPROVE','REJECT','RETURN','REQUEST_REAPPROVAL')),
    actor_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    actor_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
