CREATE TABLE IF NOT EXISTS rule_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    issuing_authority TEXT NOT NULL,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('ACT','RULE','GAZETTE','GOVERNMENT_ORDER','GR','MANUAL','CIRCULAR','OFFICIAL_WEBSITE','AUDIT_DOCUMENT','TENDER_DOCUMENT','OTHER')),
    scope_department TEXT,
    scope_jurisdiction TEXT,
    document_number TEXT,
    publication_date DATE,
    effective_from DATE,
    effective_to DATE,
    official_url TEXT,
    retrieved_at TIMESTAMPTZ,
    sha256 TEXT,
    source_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (source_status IN ('ACTIVE','SUPERSEDED','ARCHIVED','UNAVAILABLE')),
    verification_level TEXT NOT NULL
        CHECK (verification_level IN ('PRIMARY_OFFICIAL','OFFICIAL_SECONDARY','CONTRACT_SOURCE','SECONDARY')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code TEXT NOT NULL,
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    rule_name TEXT NOT NULL,
    rule_category TEXT NOT NULL
        CHECK (rule_category IN ('PREREQUISITE','AUTHORITY','CLEARANCE','WORKFLOW','DOCUMENT','SLA','VARIATION','PROCUREMENT','EXECUTION','COMPLETION','OTHER')),
    scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    action JSONB NOT NULL DEFAULT '{}'::jsonb,
    enforcement_mode TEXT NOT NULL DEFAULT 'NON_ENFORCEABLE'
        CHECK (enforcement_mode IN ('ENFORCEABLE','ADVISORY_ONLY','NON_ENFORCEABLE')),
    verification_status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (verification_status IN ('DRAFT','VERIFIED','UNVERIFIED','SUPERSEDED','DISABLED')),
    effective_from DATE,
    effective_to DATE,
    source_id UUID NOT NULL REFERENCES rule_sources(id) ON DELETE RESTRICT,
    supersedes_rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    verified_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rule_code, version_no),
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
    CHECK (enforcement_mode <> 'ENFORCEABLE' OR verification_status = 'VERIFIED')
);

CREATE TABLE IF NOT EXISTS rule_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES rule_versions(id) ON DELETE CASCADE,
    citation_type TEXT NOT NULL CHECK (citation_type IN ('CLAUSE','SECTION','PAGE','PARAGRAPH','APPENDIX','URL_FRAGMENT','OTHER')),
    locator TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rule_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    rule_version_id UUID NOT NULL REFERENCES rule_versions(id) ON DELETE RESTRICT,
    evaluation_context JSONB NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('MATCH','NO_MATCH','INDETERMINATE','ERROR')),
    explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    evaluated_by UUID REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rule_evaluations_project_time
ON rule_evaluations(project_id, evaluated_at DESC);
