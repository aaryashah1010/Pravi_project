CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    project_type_id UUID NOT NULL REFERENCES project_types(id) ON DELETE RESTRICT,
    department_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    owning_office_id UUID NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
    primary_jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    estimated_cost NUMERIC(18,2) NOT NULL CHECK (estimated_cost >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    funding_source_id UUID REFERENCES funding_sources(id) ON DELETE RESTRICT,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    lifecycle_stage TEXT NOT NULL DEFAULT 'IDENTIFICATION'
        CHECK (lifecycle_stage IN (
            'IDENTIFICATION','PROPOSAL','SITE_READINESS','FUNDING','ADMINISTRATIVE_APPROVAL',
            'DESIGN','TECHNICAL_SANCTION','CLEARANCES','PROCUREMENT','AWARD','CONTRACT',
            'WORK_ORDER','CONSTRUCTION','INSPECTION','BILLING','COMPLETION','HANDOVER',
            'DLP','CLOSED','ON_HOLD'
        )),
    operational_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (operational_status IN ('ACTIVE','AT_RISK','BLOCKED','COMPLETED','CLOSED','CANCELLED','ON_HOLD')),
    version_no BIGINT NOT NULL DEFAULT 1 CHECK (version_no > 0),
    created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_jurisdictions (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    relation_type TEXT NOT NULL DEFAULT 'PRIMARY'
        CHECK (relation_type IN ('PRIMARY','SECONDARY','IMPACTED')),
    PRIMARY KEY (project_id, jurisdiction_id)
);

CREATE TABLE IF NOT EXISTS project_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    address_line TEXT,
    city TEXT,
    district TEXT,
    taluka TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    land_owner TEXT,
    possession_status TEXT NOT NULL DEFAULT 'UNKNOWN'
        CHECK (possession_status IN ('UNKNOWN','PENDING','AVAILABLE','HANDED_OVER','DISPUTED','NOT_APPLICABLE')),
    survey_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (survey_status IN ('PENDING','IN_PROGRESS','COMPLETED','NOT_APPLICABLE')),
    soil_investigation_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (soil_investigation_status IN ('PENDING','IN_PROGRESS','COMPLETED','NOT_APPLICABLE')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    member_type TEXT NOT NULL
        CHECK (member_type IN ('PROJECT_OWNER','TECHNICAL','MONITORING','FIELD','APPROVER','VIEWER')),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    CHECK (user_id IS NOT NULL OR position_id IS NOT NULL),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_member_user
ON project_members(project_id, user_id, member_type)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_member_position
ON project_members(project_id, position_id, member_type)
WHERE position_id IS NOT NULL;
