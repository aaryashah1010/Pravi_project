CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    classification TEXT NOT NULL DEFAULT 'INTERNAL'
        CHECK (classification IN ('PUBLIC','INTERNAL','RESTRICTED','CONFIDENTIAL')),
    current_version_no INTEGER NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED','SUPERSEDED','REJECTED')),
    created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    storage_key TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'S3',
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    sha256 TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (document_id, version_no),
    UNIQUE (sha256)
);

CREATE TABLE IF NOT EXISTS project_required_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_node_instance_id UUID REFERENCES workflow_node_instances(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'MISSING'
        CHECK (status IN ('MISSING','SUBMITTED','VERIFIED','REJECTED','NOT_APPLICABLE')),
    source_rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, workflow_node_instance_id, document_type_id)
);

CREATE TABLE IF NOT EXISTS evidence_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL
        CHECK (target_type IN ('PROJECT','PROPOSAL','SANCTION','CLEARANCE','WORKFLOW_NODE','TASK','MILESTONE','INSPECTION','MEASUREMENT','BILL','ISSUE','VARIATION','COMPLETION','HANDOVER','DLP_DEFECT')),
    target_id UUID NOT NULL,
    purpose TEXT NOT NULL,
    created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_version_id, target_type, target_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_evidence_target ON evidence_links(target_type, target_id);
