# 43 — Raw SQL Repository Pattern

## Module layout

Each backend domain uses:

```text
module/
├── routes/
├── controllers/
├── dto/
├── services/
├── use-cases/
├── domain/
├── repositories/
│   ├── project.repository.ts
│   └── project.sql.ts
├── mappers/
├── validators/
└── tests/
```

## SQL ownership rule

SQL strings live in `repositories/*.sql.ts` or a nearby SQL file. Controllers must never issue SQL directly.

## Repository transaction example

Conceptually:

```text
BEGIN
  UPDATE project
  INSERT workflow transition
  INSERT audit log
  INSERT domain event
COMMIT
```

If any part fails, roll the entire transaction back.

## Authority resolution

`AuthorityResolver` executes the candidate query from `db/queries/001_authority_resolution.sql` and applies these rules:

1. zero candidates → `NO_RULE` / `MANUAL_REVIEW`;
2. one highest-specificity candidate → eligible for resolution;
3. multiple equally specific candidates → `AMBIGUOUS`;
4. resolved position without active holder → `INACTIVE_POSITION` / `MANUAL_REVIEW`;
5. active holder found → return position + current holder snapshot.

The resolver never falls back to a guessed designation.
