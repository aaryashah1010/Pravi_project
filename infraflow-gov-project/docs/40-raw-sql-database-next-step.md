# 40 — Raw SQL Database Design — Completed

## Decision

InfraFlow uses PostgreSQL with handwritten SQL migrations and repository queries. No ORM is used.

## Deliverables now included

- Full domain SQL schema.
- Organization/jurisdiction/position model.
- RBAC scope assignments.
- Versioned rule registry.
- Authority rule and resolution model.
- Workflow templates, instances and dependency graph.
- Approval and decision history.
- Documents/evidence.
- Procurement/contract/work order.
- Construction milestones, inspections, measurements and bills.
- Issues/hindrances and variations.
- Completion/handover/DLP.
- Audit/event/outbox/notifications.
- AI run/citation/suggestion records.
- Indexes, integrity triggers and core query library.
- Synthetic seed strategy.

## Migration order

See `db/README.md` for the exact migration sequence.

## Critical safety rule

No guessed government authority threshold is included in executable seed data. Exact R&B delegation thresholds remain source-dependent and must be inserted only after official verification.
