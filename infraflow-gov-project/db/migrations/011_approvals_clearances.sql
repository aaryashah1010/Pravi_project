CREATE TABLE IF NOT EXISTS approval_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_node_instance_id UUID NOT NULL UNIQUE REFERENCES workflow_node_instances(id) ON DELETE CASCADE,
    approval_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','IN_REVIEW','RETURNED','APPROVED','REJECTED','CANCELLED')),
    authority_resolution_id UUID REFERENCES authority_resolutions(id) ON DELETE SET NULL,
    decision TEXT CHECK (decision IS NULL OR decision IN ('APPROVE','REJECT','RETURN','REQUEST_INFORMATION')),
    decision_reason TEXT,
    submitted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_case_id UUID NOT NULL REFERENCES approval_cases(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('SUBMIT','START_REVIEW','APPROVE','REJECT','RETURN','REQUEST_INFORMATION','CANCEL')),
    actor_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    actor_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    reason TEXT,
    evidence_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sanctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    approval_case_id UUID NOT NULL UNIQUE REFERENCES approval_cases(id) ON DELETE CASCADE,
    sanction_type TEXT NOT NULL
        CHECK (sanction_type IN ('ADMINISTRATIVE_APPROVAL','TECHNICAL_SANCTION','REVISED_ADMINISTRATIVE_APPROVAL','OTHER')),
    sanctioned_amount NUMERIC(18,2),
    sanction_reference TEXT,
    sanction_date DATE,
    source_rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (sanctioned_amount IS NULL OR sanctioned_amount >= 0)
);

CREATE TABLE IF NOT EXISTS clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_node_instance_id UUID REFERENCES workflow_node_instances(id) ON DELETE SET NULL,
    clearance_type TEXT NOT NULL,
    issuing_authority TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('NOT_STARTED','PENDING','SUBMITTED','APPROVED','REJECTED','EXPIRED','NOT_APPLICABLE')),
    external_reference TEXT,
    application_submitted_at TIMESTAMPTZ,
    decision_at TIMESTAMPTZ,
    valid_until DATE,
    source_rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
