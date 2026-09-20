# InfraFlow PostgreSQL / Raw SQL

## Decision

PostgreSQL with handwritten SQL. No ORM.

## Migration order

Run `db/migrations/*.sql` in lexical order.

```text
001_extensions.sql
002_reference_data.sql
003_identity_rbac.sql
004_organizations_jurisdictions.sql
005_projects_and_sites.sql
006_project_preconstruction.sql
007_rule_registry.sql
008_authority_engine.sql
009_workflow_definitions.sql
010_workflow_instances_tasks.sql
011_approvals_clearances.sql
012_documents_evidence.sql
013_procurement_contracts.sql
014_work_orders_construction.sql
015_inspections_measurements_billing.sql
016_issues_variations.sql
017_completion_handover_dlp.sql
018_audit_events_notifications.sql
019_ai_copilot.sql
020_triggers_and_integrity.sql
021_indexes.sql
022_integrity_and_append_only.sql
```

## Runtime rule

Do not bypass repositories with ad-hoc SQL in controllers. All SQL belongs in repository/query files and migrations.

## Transaction rule

Any business state transition that changes workflow/project state must run in one PostgreSQL transaction containing:

1. state mutation,
2. transition/audit record,
3. domain event/outbox insert,
4. required evidence association.

## Authority rule

Authority resolution returns candidate rules first. The application must refuse automatic assignment when zero or multiple equally applicable candidates remain.

## Rule safety

A rule is executable only when `rule_versions.enforcement_mode = 'ENFORCEABLE'`, which itself is constrained by the database to require `verification_status = 'VERIFIED'`.

Do not encode current monetary authority thresholds until the applicable official delegation/compendium source has been verified.

## Query library

- `db/queries/001_authority_resolution.sql`
- `db/queries/002_root_blockers.sql`
- `db/queries/003_workflow_readiness.sql`
- `db/queries/004_project_control_tower.sql`
- `db/queries/005_rule_provenance.sql`
- `db/queries/006_audit_and_events.sql`
- `db/queries/007_optimistic_locking.sql`
