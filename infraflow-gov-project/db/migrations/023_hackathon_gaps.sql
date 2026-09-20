-- 023: fixes and additions required to run InfraFlow end-to-end.
-- Migrations 001-022 are frozen; every gap found while building is closed here.

-- 1. Credentials (demo login). Hash is set by scripts/db-seed.ts, never committed.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. User <-> contractor link (contractor-scoped access was impossible without it).
CREATE TABLE IF NOT EXISTS contractor_users (
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contractor_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_contractor_users_user ON contractor_users(user_id);

-- 3. Outbox fix: 022 made domain_events fully immutable, which makes publishing (UPDATE published_at) impossible.
--    Business content stays immutable; only publication bookkeeping may change; DELETE stays forbidden.
DROP TRIGGER IF EXISTS trg_domain_events_immutable ON domain_events;

CREATE OR REPLACE FUNCTION domain_events_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Append-only record cannot be DELETE';
    END IF;
    IF (NEW.id, NEW.aggregate_type, NEW.aggregate_id, NEW.event_type, NEW.event_version, NEW.payload, NEW.occurred_at)
       IS DISTINCT FROM
       (OLD.id, OLD.aggregate_type, OLD.aggregate_id, OLD.event_type, OLD.event_version, OLD.payload, OLD.occurred_at) THEN
        RAISE EXCEPTION 'Append-only record cannot be UPDATE (only published_at/publication_attempts may change)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_domain_events_guard
BEFORE UPDATE OR DELETE ON domain_events
FOR EACH ROW EXECUTE FUNCTION domain_events_guard();

-- 4. document_versions.sha256 was globally UNIQUE: the same photo on two projects (or a demo re-upload) failed.
ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS document_versions_sha256_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_versions_doc_sha ON document_versions(document_id, sha256);
CREATE INDEX IF NOT EXISTS idx_document_versions_sha ON document_versions(sha256);

-- 5. Workflow node timing (age vs configured SLA) without joining tasks.
ALTER TABLE workflow_node_instances ADD COLUMN IF NOT EXISTS eligible_at TIMESTAMPTZ;
ALTER TABLE workflow_node_instances ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE workflow_node_instances ADD COLUMN IF NOT EXISTS sla_days INTEGER CHECK (sla_days IS NULL OR sla_days >= 0);

-- 6. Demo marker derived from data (drives the DEMO DATA chip), and notification deep links.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- 7. Human-readable project codes (INF-2026-00001).
CREATE SEQUENCE IF NOT EXISTS project_code_seq START 1;

-- 8. Approval submitter, needed for RETURN routing and audit display.
ALTER TABLE approval_cases ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES app_users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_wni_eligible ON workflow_node_instances(workflow_instance_id, eligible_at)
WHERE activation_state IN ('ELIGIBLE','ACTIVE','BLOCKED');
