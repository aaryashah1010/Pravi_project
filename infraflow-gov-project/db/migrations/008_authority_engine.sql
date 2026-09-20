CREATE TABLE IF NOT EXISTS authority_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    decision_type TEXT NOT NULL,
    department_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    project_type_id UUID REFERENCES project_types(id) ON DELETE RESTRICT,
    jurisdiction_type TEXT,
    required_position_type_id UUID NOT NULL REFERENCES position_types(id) ON DELETE RESTRICT,
    routing_scope TEXT NOT NULL DEFAULT 'PROJECT_JURISDICTION'
        CHECK (routing_scope IN ('PROJECT_JURISDICTION','OWNING_OFFICE','PARENT_JURISDICTION','STATE','EXPLICIT_OFFICE')),
    min_cost NUMERIC(18,2),
    max_cost NUMERIC(18,2),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    priority INTEGER NOT NULL DEFAULT 100,
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    valid_from DATE,
    valid_to DATE,
    rule_version_id UUID NOT NULL REFERENCES rule_versions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('ACTIVE','DRAFT','DISABLED','SUPERSEDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (min_cost IS NULL OR min_cost >= 0),
    CHECK (max_cost IS NULL OR max_cost >= 0),
    CHECK (min_cost IS NULL OR max_cost IS NULL OR min_cost <= max_cost),
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS authority_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_node_instance_id UUID,
    approval_type TEXT NOT NULL,
    authority_rule_id UUID REFERENCES authority_rules(id) ON DELETE RESTRICT,
    rule_evaluation_id UUID REFERENCES rule_evaluations(id) ON DELETE RESTRICT,
    required_position_type_id UUID REFERENCES position_types(id) ON DELETE RESTRICT,
    resolved_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    resolved_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    resolution_status TEXT NOT NULL
        CHECK (resolution_status IN ('RESOLVED','UNRESOLVED','AMBIGUOUS','NO_RULE','INACTIVE_POSITION','MANUAL_REVIEW')),
    candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
    resolution_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_authority_rules_lookup
ON authority_rules(decision_type, department_organization_id, project_type_id, jurisdiction_type, min_cost, max_cost, priority)
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_authority_resolutions_project
ON authority_resolutions(project_id, approval_type, created_at DESC);
