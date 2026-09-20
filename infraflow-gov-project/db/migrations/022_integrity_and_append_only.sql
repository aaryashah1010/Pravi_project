-- Cross-domain foreign keys that could not be declared earlier because documents are created later.
ALTER TABLE project_budget_allocations
    ADD CONSTRAINT fk_budget_source_document
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE contract_securities
    ADD CONSTRAINT fk_security_document
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE work_orders
    ADD CONSTRAINT fk_work_order_source_document
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE approval_decisions
    ADD CONSTRAINT fk_approval_decision_evidence_document
    FOREIGN KEY (evidence_document_id) REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE rule_citations
    ADD CONSTRAINT chk_rule_citation_page_range
    CHECK (page_start IS NULL OR page_end IS NULL OR page_end >= page_start);

CREATE TABLE IF NOT EXISTS rule_activation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES rule_versions(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('ACTIVATE','DEACTIVATE','VERIFY','SUPERSEDE','DISABLE')),
    actor_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Append-only record cannot be %', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_approval_decisions_immutable ON approval_decisions;
CREATE TRIGGER trg_approval_decisions_immutable BEFORE UPDATE OR DELETE ON approval_decisions
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_variation_decisions_immutable ON variation_decisions;
CREATE TRIGGER trg_variation_decisions_immutable BEFORE UPDATE OR DELETE ON variation_decisions
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_workflow_transitions_immutable ON workflow_transitions;
CREATE TRIGGER trg_workflow_transitions_immutable BEFORE UPDATE OR DELETE ON workflow_transitions
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_domain_events_immutable ON domain_events;
CREATE TRIGGER trg_domain_events_immutable BEFORE UPDATE OR DELETE ON domain_events
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

CREATE INDEX IF NOT EXISTS idx_rule_activation_log_rule_time
ON rule_activation_log(rule_version_id, created_at DESC);
