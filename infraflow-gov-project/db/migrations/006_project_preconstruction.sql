CREATE TABLE IF NOT EXISTS project_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    justification TEXT NOT NULL,
    scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    preliminary_estimate NUMERIC(18,2) NOT NULL CHECK (preliminary_estimate >= 0),
    funding_notes TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','SUBMITTED','RETURNED','APPROVED','REJECTED','SUPERSEDED')),
    submitted_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_current_project_proposal
ON project_proposals(project_id)
WHERE status IN ('SUBMITTED','APPROVED');

CREATE TABLE IF NOT EXISTS project_budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    financial_year TEXT NOT NULL,
    provisioned_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (provisioned_amount >= 0),
    allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
    released_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (released_amount >= 0),
    utilized_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (utilized_amount >= 0),
    source_document_id UUID,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, financial_year)
);

CREATE TABLE IF NOT EXISTS design_estimate_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    package_type TEXT NOT NULL DEFAULT 'DETAILED'
        CHECK (package_type IN ('PRELIMINARY','DETAILED','REVISED','AS_BUILT')),
    description TEXT,
    estimated_cost NUMERIC(18,2) NOT NULL CHECK (estimated_cost >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','UNDER_REVIEW','APPROVED','RETURNED','SUPERSEDED')),
    prepared_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, version_no)
);

CREATE TABLE IF NOT EXISTS boq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    design_estimate_package_id UUID REFERENCES design_estimate_packages(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    estimated_quantity NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (estimated_quantity >= 0),
    rate NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
    estimated_amount NUMERIC(18,2) GENERATED ALWAYS AS (round(estimated_quantity * rate, 2)) STORED,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, code)
);
