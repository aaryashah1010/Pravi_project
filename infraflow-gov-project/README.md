# InfraFlow — Government Infrastructure Lifecycle & Workflow Platform

## Purpose

InfraFlow is a source-backed workflow and project monitoring platform for government/public infrastructure projects in Gujarat.

The platform is designed to connect project initiation, approvals/sanctions, authority routing, procurement references, contract execution, field monitoring, inspections, measurements, billing milestones, changes, delays, completion, handover, and defect-liability/maintenance tracking.

The platform is **not** a replacement for every existing Government of Gujarat application. It is designed as a project orchestration and decision-support layer that can integrate with or reference existing systems such as government workflow/document platforms and eProcurement.

## Core product principle

Official government rules and source documents are authoritative.

The application may automatically enforce only rules whose applicability has been verified and whose source provenance is stored.

AI can explain, detect anomalies, summarize, and recommend next actions, but AI cannot itself exercise statutory/administrative approval authority.

## Current implementation scope

The first implementation targets a configurable public-works / government-building workflow in Gujarat.

The system intentionally does **not** claim that every government building in Gujarat follows one identical approval chain. The workflow depends on department, project type, location/jurisdiction, cost, applicable regulations, delegated powers, project-specific documents, and current rules.

## Rule status vocabulary

- VERIFIED: supported by an identified official source and suitable for deterministic enforcement within the stated scope.
- CONDITIONAL: requirement exists, but applicability depends on project facts or another rule. The condition must be explicitly represented.
- CONTRACT-SPECIFIC: applies because of a specific contract/tender and must not be generalized to all projects.
- REFERENCE: useful official material for understanding workflow/data, but not itself enough to create a universal executable rule.
- UNVERIFIED: not yet supported by a sufficiently authoritative source. The engine must not enforce it.
- SUPERSEDED: historical rule retained for audit/history but not used for new decisions.

## Current research date

2026-09-20

## Important legal/product disclaimer

This is a technical prototype and decision-support system. It is not a legal opinion, not a substitute for current departmental orders, and not a complete codification of all Gujarat or Indian construction law. Before production deployment, the rule registry must be reviewed and approved by the relevant department/legal/engineering authority, and each rule must be versioned against its effective date.

## Repository structure

```text
infraflow-gov-project/
├── README.md
├── db/
│   ├── migrations/
│   ├── queries/
│   ├── seeds/
│   └── views/
├── rules/
│   ├── registry/
│   └── sources/
├── docs/
│   ├── 01-problem-definition.md
│   ├── 02-domain-understanding.md
│   ├── 03-project-lifecycle.md
│   ├── 04-stakeholders-and-users.md
│   ├── 05-organization-and-authority-model.md
│   ├── 06-approval-engine.md
│   ├── 07-workflow-and-dependency-engine.md
│   ├── 08-construction-monitoring.md
│   ├── 09-document-and-evidence-management.md
│   ├── 10-contractor-and-procurement.md
│   ├── 11-finance-measurement-and-billing.md
│   ├── 12-change-hindrance-and-delay.md
│   ├── 13-completion-handover-and-dlp.md
│   ├── 14-ai-copilot.md
│   ├── 15-rbac-security-and-audit.md
│   ├── 16-database-schema.md
│   ├── 17-api-design.md
│   ├── 18-system-architecture.md
│   ├── 19-frontend-information-architecture.md
│   ├── 20-deployment-and-docker.md
│   ├── 21-mvp-scope-and-build-plan.md
│   ├── 22-rule-registry.md
│   ├── 23-source-catalog.md
│   ├── 24-implementation-decisions.md
│   ├── rules/
│   │   └── rule-cards.md
│   ├── data/
│   │   └── seed-data.md
│   ├── api/
│   │   └── openapi-outline.md
│   ├── architecture/
│   │   ├── diagrams.md
│   │   └── event-model.md
│   ├── deployment/
│   │   └── production-checklist.md
│   ├── product/
│   │   └── ui-copy.md
│   ├── security/
│   │   └── threat-model.md
│   └── research/
│       └── research-log.md
└── infraflow-docs.zip
```

## Recommended technical stack

Frontend: React + TypeScript + Vite

Backend: Node.js + TypeScript + NestJS (recommended) or Fastify/Express if a lighter service is preferred

Database: PostgreSQL

Cache/queues: Redis

Object storage: S3-compatible storage (MinIO locally; cloud object storage in deployment)

Workflow execution: application service using PostgreSQL-backed state transitions; Temporal/Camunda can be considered later if workflow volume/complexity justifies it

Search/RAG: PostgreSQL full-text + pgvector for prototype; dedicated vector/search infrastructure later if necessary

AI: provider-agnostic service abstraction; LLM + embeddings selected by deployment constraints

Reverse proxy: Nginx or Caddy

Containers: Docker + Docker Compose for development and single-server deployment

CI/CD: GitHub Actions

Observability: OpenTelemetry-compatible traces/logs; Prometheus/Grafana can be added later

## Build order

1. Rule registry and domain model.
2. Organization + authority model.
3. Project creation and workflow generation.
4. Approval/task execution.
5. Dependency graph and blocker analysis.
6. Construction milestones and inspections.
7. Documents/evidence and audit trail.
8. Procurement/contract reference.
9. AI copilot over verified rules + live project state.
10. Dashboards and public read-only view.
11. Docker deployment and security hardening.

## Engineering repository target

The implementation will use a React + TypeScript frontend, Node.js + TypeScript backend, PostgreSQL, Redis, S3-compatible object storage, and Docker. Backend domains use a module-wise pattern of routes/controllers/DTOs/use-cases/services/domain/repositories/tests. See `docs/27-engineering-architecture.md`, `docs/28-repository-folder-structure.md`, and `docs/29-module-architecture.md`.

## Database implementation

PostgreSQL is implemented with handwritten SQL migrations and repository queries. No ORM is used. The current schema is in `db/migrations/001` through `db/migrations/022`. Query patterns for authority resolution, dependency traversal, workflow readiness, control-tower reporting, provenance, audit/outbox and optimistic locking are in `db/queries/`. Synthetic reference/demo data is in `db/seeds/`. See `docs/41-sql-erd-and-table-catalog.md` through `docs/44-sql-build-order-and-readiness.md`.

## Rule governance

Government rules are not hard-coded ad hoc in controllers/services. Official source material is catalogued in a versioned rule registry with provenance and effective dates. See `docs/25-official-rule-research-and-evidence.md`, `docs/32-official-research-matrix.md`, and `docs/22-rule-registry.md`.

## Domain model

The canonical domain and relationships are defined in `docs/26-domain-model-and-relationships.md`. The initial implementation is intentionally limited to a configurable government/public-works building scenario and will be expanded to additional project types only after separate rule packages are researched.

## UI generation

`docs/30-stitch-ui-prompt.md` contains the detailed Stitch prompt for generating the initial product UI. The UI should expose project state, blockers, dependencies, approvals, source provenance, construction monitoring, inspection, audit and the advisory AI copilot.

## Current official research baseline

The current research confirms that Gujarat already has government workflow/document infrastructure through IWDMS and electronic procurement through the state's eProcurement platform. These are treated as integration/context boundaries, not systems we are claiming to replace. citeturn424622search0turn424622search1

The Government of Gujarat also hosts a page listing the Gujarat Public Works Manual Volume I — Orders. Exact manual clause extraction remains an open task because the document download endpoint currently redirects incorrectly through the automated retrieval path. citeturn424622search2

An official Gujarat R&B audit document quotes the Public Works Manual on two concrete pre-commencement requirements: detailed structural designs must be approved and work should not commence on land that has not been duly handed over. These are recorded as the initial verified baseline rules, not as a complete universal rulebook. citeturn511836search16

An official Gujarat civil technical specification documents contractor site records such as measurement books, quality inspection reports, progress charts, hindrance registers, work diaries, variation registers, inspection requests and quality checklists; these are incorporated as evidence/data model requirements for the specification's scope. citeturn328231view0

## Latest authority research status

The 2020 Gujarat Engineering Works Manual gives concrete R&BD/WRD workflow rules for budget provision, Administrative Approval, Technical Sanction, building-design preparation, local-body approval where required, staged land/service prerequisites, revised approval conditions, tender-document approval, contract completion and construction records. It also states that R&BD/WRD officer powers are governed by the delegation/compendium material and specifically points to Appendix XXIII of Engineering Works Manual Volume II.

The official Gujarat Water Resources decision-process page additionally publishes a department-specific Administrative Approval matrix for new WRD schemes: up to Rs. 30 lakh at Chief Engineer + Additional Secretary level; >Rs. 30 lakh to Rs. 1 crore at Secretary/WRD with Financial Advisor consultation; >Rs. 1 crore to Rs. 5 crore at Additional Chief Secretary, Expenditure/Finance; and >Rs. 5 crore at Additional Chief Secretary, Finance Department. This WRD matrix must not be generalized to R&B.

The exact current R&B monetary delegation matrix remains an open research item. The prototype will not infer it from designation names or copy the WRD matrix.

See `docs/37-authority-and-workflow-research-findings.md`, `docs/38-verified-rule-registry-v1.md`, `docs/39-rule-engine-safe-behavior.md`, and `docs/40-raw-sql-database-next-step.md`.
