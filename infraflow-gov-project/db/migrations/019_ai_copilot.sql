CREATE TABLE IF NOT EXISTS ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    mode TEXT NOT NULL
        CHECK (mode IN ('EXPLAIN','RECOMMEND','DETECT','SUMMARIZE','DRAFT','DOCUMENT_EXTRACTION')),
    model_provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    input_context JSONB NOT NULL,
    output JSONB,
    status TEXT NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','COMPLETED','FAILED','CANCELLED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    latency_ms INTEGER,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS ai_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id UUID NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
    citation_type TEXT NOT NULL CHECK (citation_type IN ('RULE','SOURCE','DOCUMENT','PROJECT_RECORD')),
    rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    source_id UUID REFERENCES rule_sources(id) ON DELETE RESTRICT,
    document_version_id UUID REFERENCES document_versions(id) ON DELETE RESTRICT,
    target_id UUID,
    locator TEXT,
    snippet TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id UUID NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    suggestion_type TEXT NOT NULL
        CHECK (suggestion_type IN ('NEXT_ACTION','BLOCKER','PARALLEL_WORK','DOCUMENT_GAP','RULE_EXPLANATION','INCONSISTENCY','ESCALATION_REVIEW')),
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    action_payload JSONB,
    confidence TEXT CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
    status TEXT NOT NULL DEFAULT 'SUGGESTED'
        CHECK (status IN ('SUGGESTED','ACCEPTED','DISMISSED','EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI records are advisory and do not contain an approval mutation path.
