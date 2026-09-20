# 42 — SQL Domain Invariants

The database enforces structural integrity. Complex policy interpretation stays in the application/rules engine.

## Enforced invariants

- Project cost cannot be negative.
- Workflow dependencies cannot self-loop.
- Rule versions cannot be executable unless verified.
- Rule effective-to cannot precede effective-from.
- Authority min cost cannot exceed max cost.
- Active entity date ranges cannot be inverted.
- Bill deductions cannot exceed gross amount.
- Progress values remain 0–100.
- Coordinates remain valid ranges.
- Version numbers remain positive.
- Required FK relationships cannot point to deleted records.
- Human approval decisions are append-only in `approval_decisions`.
- Audit records are append-only by repository convention; no application delete endpoint exists.

## Deliberately NOT enforced in SQL

These require source-backed rule logic, not generic DB constraints:

- Who is the competent authority for a particular project.
- Whether a clearance is required.
- Whether a variation needs revised sanction.
- Whether two approvals can proceed in parallel.
- Whether a project may commence construction.
- Exact financial/administrative thresholds.
- Contract-specific clauses.

## Concurrency

Use `version_no` optimistic locking on projects/tasks and row locking (`FOR UPDATE`) when claiming workflow tasks or making mutually exclusive decisions.
