CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    project_type_id UUID REFERENCES project_types(id) ON DELETE RESTRICT,
    department_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    generation_mode TEXT NOT NULL DEFAULT 'HYBRID'
        CHECK (generation_mode IN ('MANUAL_TEMPLATE','RULE_GENERATED','HYBRID')),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','ACTIVE','SUPERSEDED','DISABLED')),
    effective_from DATE,
    effective_to DATE,
    created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (code, version_no),
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS workflow_node_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    node_code TEXT NOT NULL,
    name TEXT NOT NULL,
    node_type TEXT NOT NULL
        CHECK (node_type IN ('GATE','TASK','APPROVAL','CLEARANCE','DOCUMENT','INSPECTION','MILESTONE','INFORMATION')),
    required_by_default BOOLEAN NOT NULL DEFAULT TRUE,
    activation_condition JSONB NOT NULL DEFAULT '{}'::jsonb,
    assigned_position_type_id UUID REFERENCES position_types(id) ON DELETE RESTRICT,
    rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workflow_template_id, node_code)
);

CREATE TABLE IF NOT EXISTS workflow_edge_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    from_node_template_id UUID NOT NULL REFERENCES workflow_node_templates(id) ON DELETE CASCADE,
    to_node_template_id UUID NOT NULL REFERENCES workflow_node_templates(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL
        CHECK (dependency_type IN ('BLOCKING','REQUIRES_COMPLETION','INFORMATIONAL','PARALLEL','CONDITIONAL')),
    condition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workflow_template_id, from_node_template_id, to_node_template_id, dependency_type),
    CHECK (from_node_template_id <> to_node_template_id)
);

CREATE TABLE IF NOT EXISTS workflow_required_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_template_id UUID NOT NULL REFERENCES workflow_node_templates(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    condition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (node_template_id, document_type_id)
);
