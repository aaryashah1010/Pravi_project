# 27 — Engineering Architecture

## Technology decision

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- State library only where server state is insufficient

### Backend

- Node.js
- TypeScript
- NestJS recommended for the application framework
- REST API as the primary external interface
- OpenAPI specification generated and versioned

### Data

- PostgreSQL — source of truth
- Redis — caching, rate limiting, short-lived jobs/locks
- S3-compatible object storage — documents/photos; MinIO for local development

### Infrastructure

- Docker
- Docker Compose for development and single-server deployment
- Nginx as reverse proxy
- GitHub Actions for CI/CD

## Backend architectural pattern

Every business module follows:

```text
routes/controllers
        ↓
DTO / validation
        ↓
application service / use-case
        ↓
domain policy / rule invocation
        ↓
repository interface
        ↓
PostgreSQL repository implementation
```

Cross-cutting components:

```text
Auth
Authorization
Audit
Events
Notifications
File storage
Observability
AI gateway
Rule registry
```

## Module structure

Each module is isolated by domain responsibility.

```text
modules/
  projects/
  organizations/
  authority/
  rules/
  workflows/
  approvals/
  clearances/
  procurement/
  contracts/
  construction/
  inspections/
  measurements/
  billing/
  issues/
  variations/
  documents/
  evidence/
  notifications/
  audit/
  dashboards/
  ai/
```

## Standard module structure

```text
module-name/
├── module.ts
├── routes/
│   └── *.routes.ts
├── controllers/
│   └── *.controller.ts
├── dto/
│   ├── create-*.dto.ts
│   └── update-*.dto.ts
├── services/
│   └── *.service.ts
├── use-cases/
│   └── *.usecase.ts
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── policies/
│   └── events/
├── repositories/
│   ├── *.repository.ts
│   └── *.repository.impl.ts
├── mappers/
├── validators/
├── queries/
├── commands/
├── tests/
└── index.ts
```

Use only folders needed for a module; do not create empty ceremony.

## Request flow

Example: submit approval.

```text
HTTP
 ↓
Auth middleware
 ↓
Authorization guard
 ↓
ApprovalController
 ↓
SubmitApprovalUseCase
 ↓
ApprovalPolicy / WorkflowPolicy
 ↓
ApprovalRepository
 ↓
Transaction
 ↓
State change
 ↓
Outbox event
 ↓
Audit record
 ↓
Notification job
```

## Rule engine boundary

The rule engine must be a domain service with no dependency on HTTP.

Inputs:

- project facts
- current date/effective date
- project type
- organization context
- rule package/version

Outputs:

- required workflow nodes
- required evidence
- authority requirements
- conditions
- dependencies

The engine must never infer a legal requirement from an LLM response.

## Workflow engine boundary

The workflow engine is responsible for:

- creating workflow instances from approved templates
- evaluating dependencies
- moving nodes through valid state transitions
- generating tasks
- blocking/unblocking downstream nodes
- recording transition history

It does not decide government law; it executes the rule/template result.

## Authority resolver boundary

Input:

```text
project
approval type
current effective date
organization scope
```

Output:

```text
authority requirement
position
office/jurisdiction
current active position holder
```

If no authoritative rule resolves the authority, return `UNRESOLVED_AUTHORITY` rather than guessing.

## AI gateway boundary

All model access goes through one internal interface.

AI capabilities:

- document extraction
- source-grounded explanation
- project-state summarization
- anomaly detection assistance
- next-action recommendations
- draft/checklist generation

AI outputs are tagged `ADVISORY` and never directly mutate approval/legal state.

## Transaction strategy

Use PostgreSQL transactions for:

- approval decision + state transition
- workflow transition + task generation
- variation approval + project revision state
- measurement verification + billing readiness change

Use the outbox pattern for external side effects.

## Event-driven boundaries

Initial internal events:

```text
ProjectCreated
ProjectSubmitted
RuleEvaluationCompleted
WorkflowGenerated
ApprovalSubmitted
ApprovalReturned
ApprovalApproved
ApprovalRejected
TaskAssigned
TaskOverdue
EscalationTriggered
MilestoneUpdated
InspectionSubmitted
InspectionFailed
InspectionPassed
IssueRaised
IssueResolved
VariationSubmitted
VariationApproved
ContractLinked
WorkOrderIssued
CompletionSubmitted
HandoverCompleted
DLPStarted
DLPExpired
```

## Idempotency

Mutating APIs that may be retried should accept an idempotency key.

At minimum:

- create project
- submit approval
- approve/reject/return decision
- upload evidence registration
- inspection submission
- variation submission

## Concurrency

Approval decisions and workflow transitions must use optimistic locking or row-level locking so two users cannot produce contradictory final states.

## Error contract

All API errors return a stable structure:

```text
code
message
requestId
fieldErrors[]
sourceRuleId (optional)
```

Do not leak internal stack traces.
