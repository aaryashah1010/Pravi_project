# 28 — Repository Folder Structure

```text
infraflow/
├── apps/
│   ├── web/                         # React + TypeScript + Vite
│   └── api/                         # Node + TypeScript + NestJS
├── packages/
│   ├── shared-types/
│   ├── validation/
│   ├── api-client/
│   ├── ui/
│   └── config/
├── db/
│   ├── migrations/                 # handwritten PostgreSQL DDL only
│   ├── queries/                    # repository query library
│   ├── seeds/                      # idempotent synthetic/reference seeds
│   └── views/                      # read-only SQL views
├── rules/
│   ├── registry/
│   │   ├── verified/
│   │   ├── conditional/
│   │   ├── contract-specific/
│   │   ├── unverified/
│   │   └── superseded/
│   └── sources/
├── docs/
├── infra/
│   ├── nginx/
│   ├── postgres/
│   ├── redis/
│   └── minio/
├── scripts/
└── .github/workflows/
```

## Backend module structure

Each domain is isolated:

```text
apps/api/src/modules/projects/
├── routes/
├── controllers/
├── dto/
├── services/
├── use-cases/
├── domain/
├── repositories/
├── mappers/
├── validators/
└── tests/
```

No controller talks directly to PostgreSQL.

## Rule separation

```text
Official source
    ↓
Rule registry
    ↓
Rules engine
    ↓
Workflow/authority service
```

Government policy does not live as arbitrary `if/else` branches in controllers.
