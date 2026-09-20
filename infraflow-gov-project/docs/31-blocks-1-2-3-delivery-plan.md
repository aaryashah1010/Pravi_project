# 31 — Blocks 1, 2, 3 Delivery Plan

## Block 1 — Official rule research

### Objective

Build a verified, versioned rule catalog for the first project type.

### Deliverables

- source catalog
- rule registry
- authority source map
- effective-date metadata
- conditional-rule model
- unresolved-rule list
- rule review checklist

### Research sequence

1. Obtain the current Gujarat Public Works Manual Volume I/II from an official government endpoint.
2. Extract the chapters relevant to original works, AA, TS, estimates, contracts, execution, revised/supplementary estimates, completion, powers and measurement.
3. Obtain the current Compendium of Administrative/Financial/Statutory Powers referred to by Gujarat government sources.
4. Map the authority for each approval type.
5. Validate effective/superseded dates.
6. Separately research planning/building/fire/other statutory clearances for the selected jurisdiction.
7. Mark anything not verified as unexecutable.

## Block 2 — Domain model

### Objective

Freeze entities and relationships before implementation.

### Deliverables

- ERD
- entity definitions
- states and transitions
- organization model
- position model
- authority model
- workflow model
- dependency model
- evidence model

### Freeze rules

- Do not add an entity merely to satisfy UI requirements.
- Do not merge different legal/operational concepts into one generic `Approval` object.
- Do not store legal thresholds as application constants.
- Keep project truth separate from rule metadata.

## Block 3 — Engineering architecture

### Objective

Translate the domain model into an implementation-ready architecture.

### Deliverables

- repository structure
- module boundaries
- controller/service/repository conventions
- API conventions
- database schema
- event model
- security model
- Docker topology
- AI gateway
- rule engine interfaces

### Implementation order after Block 3

1. repository skeleton
2. database + migrations
3. organization/position/user module
4. rule registry
5. authority resolver
6. project module
7. workflow engine
8. approvals
9. dependency/blocker engine
10. construction/inspection
11. evidence/documents
12. contractor/contract/tender references
13. issues/variations
14. dashboards
15. AI Copilot
16. Docker/CI/CD hardening

## Quality gates

### Gate A — Source integrity

No critical executable rule without provenance.

### Gate B — Domain integrity

Every core relationship has explicit cardinality and ownership.

### Gate C — Authorization integrity

Every mutation is protected by role + scope + authority checks.

### Gate D — Workflow integrity

Invalid transitions are impossible at API/domain level.

### Gate E — AI safety

AI cannot directly approve, reject, route statutory authority, or change rule status.
