CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    legal_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','INACTIVE')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractor_project_assignments (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
    assignment_type TEXT NOT NULL DEFAULT 'PRIMARY'
        CHECK (assignment_type IN ('PRIMARY','JOINT','SUBCONTRACTOR')),
    start_at DATE,
    end_at DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED','CANCELLED')),
    PRIMARY KEY (project_id, contractor_id, assignment_type),
    CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at)
);

CREATE TABLE IF NOT EXISTS tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_system TEXT,
    external_reference TEXT,
    tender_number TEXT,
    estimated_value NUMERIC(18,2) NOT NULL CHECK (estimated_value >= 0),
    published_at TIMESTAMPTZ,
    closing_at TIMESTAMPTZ,
    current_stage TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','PUBLISHED','EVALUATION','AWARDED','CANCELLED','CLOSED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tender_bidders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
    eligibility_status TEXT,
    technical_status TEXT,
    financial_rank INTEGER,
    offered_value NUMERIC(18,2),
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','QUALIFIED','DISQUALIFIED','SELECTED','NOT_SELECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tender_id, contractor_id)
);

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    tender_id UUID REFERENCES tenders(id) ON DELETE SET NULL,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
    contract_number TEXT NOT NULL UNIQUE,
    awarded_value NUMERIC(18,2) NOT NULL CHECK (awarded_value >= 0),
    contract_date DATE,
    start_date DATE,
    completion_date DATE,
    dlp_start_date DATE,
    dlp_end_date DATE,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','COMPLETED','TERMINATED','CLOSED')),
    terms JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (completion_date IS NULL OR start_date IS NULL OR completion_date >= start_date),
    CHECK (dlp_end_date IS NULL OR dlp_start_date IS NULL OR dlp_end_date >= dlp_start_date)
);

CREATE TABLE IF NOT EXISTS contract_securities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    security_type TEXT NOT NULL,
    reference_number TEXT,
    issuing_entity TEXT,
    amount NUMERIC(18,2),
    valid_from DATE,
    valid_until DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','RELEASED','EXPIRED','FORFEITED')),
    document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (amount IS NULL OR amount >= 0)
);
