CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
    work_order_number TEXT NOT NULL UNIQUE,
    issue_date DATE,
    start_date DATE,
    stipulated_completion_date DATE,
    issuing_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','ISSUED','ACTIVE','SUSPENDED','COMPLETED','CANCELLED')),
    source_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (stipulated_completion_date IS NULL OR start_date IS NULL OR stipulated_completion_date >= start_date)
);

CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sequence_no INTEGER,
    planned_start DATE,
    planned_finish DATE,
    actual_start DATE,
    actual_finish DATE,
    planned_progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (planned_progress BETWEEN 0 AND 100),
    reported_progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (reported_progress BETWEEN 0 AND 100),
    verified_progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (verified_progress BETWEEN 0 AND 100),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','IN_PROGRESS','AT_RISK','BLOCKED','COMPLETED','CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, code)
);

CREATE TABLE IF NOT EXISTS milestone_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reported_progress NUMERIC(5,2) NOT NULL CHECK (reported_progress BETWEEN 0 AND 100),
    narrative TEXT,
    evidence_notes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS milestone_dependencies (
    predecessor_milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    successor_milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'BLOCKING'
        CHECK (dependency_type IN ('BLOCKING','REQUIRES_COMPLETION','INFORMATIONAL','PARALLEL')),
    PRIMARY KEY (predecessor_milestone_id, successor_milestone_id),
    CHECK (predecessor_milestone_id <> successor_milestone_id)
);
