CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    organization_type TEXT NOT NULL,
    parent_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jurisdictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    jurisdiction_type TEXT NOT NULL,
    parent_jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    parent_office_id UUID REFERENCES offices(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    office_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS office_jurisdictions (
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
    coverage_type TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (coverage_type IN ('PRIMARY','SECONDARY')),
    PRIMARY KEY (office_id, jurisdiction_id)
);

CREATE TABLE IF NOT EXISTS position_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    designation TEXT NOT NULL,
    position_category TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
    position_type_id UUID NOT NULL REFERENCES position_types(id) ON DELETE RESTRICT,
    position_code TEXT NOT NULL,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VACANT','INACTIVE')),
    active_from DATE,
    active_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (office_id, position_code),
    CHECK (active_to IS NULL OR active_from IS NULL OR active_to >= active_from)
);

CREATE TABLE IF NOT EXISTS user_position_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    assignment_type TEXT NOT NULL DEFAULT 'PRIMARY'
        CHECK (assignment_type IN ('PRIMARY','ADDITIONAL_CHARGE','TEMPORARY','ACTING')),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_user_position_current
ON user_position_assignments(position_id, start_at DESC)
WHERE is_active = TRUE AND end_at IS NULL;

CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- Role scope is intentionally nullable: NULL means global within the user's granted role.
CREATE INDEX IF NOT EXISTS idx_user_role_scope
ON user_role_assignments(user_id, role_id, organization_id, office_id, jurisdiction_id)
WHERE is_active = TRUE;
