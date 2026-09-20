CREATE TABLE IF NOT EXISTS inspection_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    project_type_id UUID REFERENCES project_types(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    checklist_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    inspection_template_id UUID REFERENCES inspection_templates(id) ON DELETE RESTRICT,
    requested_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    inspector_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    inspector_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ,
    inspected_at TIMESTAMPTZ,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    result TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (result IN ('PENDING','PASS','FAIL','OBSERVATION','RETURNED','CANCELLED')),
    observations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS inspection_checklist_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL,
    item_label TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('PASS','FAIL','NA','OBSERVATION')),
    notes TEXT,
    UNIQUE (inspection_id, item_code)
);

CREATE TABLE IF NOT EXISTS measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    boq_item_id UUID REFERENCES boq_items(id) ON DELETE RESTRICT,
    inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
    measurement_reference TEXT NOT NULL,
    measured_quantity NUMERIC(18,6) NOT NULL CHECK (measured_quantity >= 0),
    unit TEXT NOT NULL,
    measured_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    verified_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    measured_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','VERIFIED','REJECTED','CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
    bill_number TEXT NOT NULL UNIQUE,
    bill_type TEXT NOT NULL DEFAULT 'RUNNING'
        CHECK (bill_type IN ('ADVANCE','RUNNING','FINAL','RETENTION_RELEASE','OTHER')),
    gross_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
    deductions NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
    net_amount NUMERIC(18,2) GENERATED ALWAYS AS (gross_amount - deductions) STORED,
    technical_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (technical_status IN ('PENDING','VERIFIED','REJECTED')),
    financial_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (financial_status IN ('PENDING','PROCESSED','REJECTED')),
    payment_reference TEXT,
    payment_date DATE,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (deductions <= gross_amount)
);

CREATE TABLE IF NOT EXISTS bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    boq_item_id UUID REFERENCES boq_items(id) ON DELETE RESTRICT,
    measurement_id UUID REFERENCES measurements(id) ON DELETE RESTRICT,
    quantity NUMERIC(18,6) NOT NULL CHECK (quantity >= 0),
    rate NUMERIC(18,4) NOT NULL CHECK (rate >= 0),
    amount NUMERIC(18,2) GENERATED ALWAYS AS (round(quantity * rate, 2)) STORED,
    UNIQUE (bill_id, measurement_id)
);
