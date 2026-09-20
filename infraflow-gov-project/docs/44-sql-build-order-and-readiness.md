# 44 — SQL Build Order & Readiness

## Database implementation order

1. Apply migrations 001–021.
2. Load reference seed data.
3. Load synthetic organization seed data.
4. Add only source-backed executable rule records.
5. Add workflow templates after rule/authority records exist.
6. Run repository integration tests against PostgreSQL.

## First backend modules that can be coded immediately

1. `auth`
2. `users`
3. `organizations`
4. `positions`
5. `projects`
6. `rules`
7. `authority`
8. `workflows`
9. `approvals`

Construction/finance/AI modules can follow.

## Database readiness checklist

- [ ] PostgreSQL container configured.
- [ ] Migrations run cleanly from empty database.
- [ ] Downstream migrations have explicit FK ordering.
- [ ] Seed script is idempotent.
- [ ] No guessed authority thresholds in executable seeds.
- [ ] Rule provenance tested.
- [ ] Authority ambiguity tested.
- [ ] Workflow recursive blocker query tested.
- [ ] Transactional outbox tested.
- [ ] Optimistic locking conflict tested.

## After this

Once this SQL design is accepted, application coding can begin without an ORM. The first vertical slice should be:

```text
Login
 → organization/position resolution
 → create project
 → evaluate verified/conditional rules
 → generate workflow
 → resolve authority
 → create approval task
 → audit + event
```
