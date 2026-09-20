CREATE TABLE IF NOT EXISTS completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    final_inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
    completion_certificate_reference TEXT,
    completion_date DATE,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','UNDER_REVIEW','CERTIFIED','RETURNED','REJECTED')),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    completion_id UUID NOT NULL REFERENCES completions(id) ON DELETE RESTRICT,
    receiving_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    receiving_office_id UUID REFERENCES offices(id) ON DELETE RESTRICT,
    handover_date DATE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','RETURNED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dlp_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PLANNED','ACTIVE','EXPIRED','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS dlp_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dlp_period_id UUID NOT NULL REFERENCES dlp_periods(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at TIMESTAMPTZ,
    rectified_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ASSIGNED','RECTIFIED','VERIFIED','CLOSED','DISPUTED')),
    contractor_id UUID REFERENCES contractors(id) ON DELETE RESTRICT,
    created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT
);
