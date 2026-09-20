# 16 — Database Schema

InfraFlow uses PostgreSQL with handwritten SQL migrations and repository queries. No ORM is used.

The canonical executable schema is under `db/migrations/`.

See:

- `docs/41-sql-erd-and-table-catalog.md`
- `docs/42-sql-domain-invariants.md`
- `docs/43-sql-repository-pattern.md`
- `docs/44-sql-build-order-and-readiness.md`
- `db/README.md`

## High-level groups

```text
Identity / RBAC
  ↓
Organization / Office / Position / Jurisdiction
  ↓
Project / Site / Proposal / Budget / Design
  ↓
Rules / Authority
  ↓
Workflow / Dependency / Tasks
  ↓
Approvals / Clearances / Documents / Evidence
  ↓
Tender / Contract / Work Order
  ↓
Construction / Inspection / Measurement / Billing
  ↓
Issues / Variations
  ↓
Completion / Handover / DLP
  ↓
Audit / Events / Notifications / AI
```

## Raw SQL migration principle

No government policy rule is hidden inside a schema trigger. The database enforces only data integrity. Government rules are represented by the versioned rule registry and evaluated by the application rules engine.
