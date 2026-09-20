# 29 — Module Architecture & Backend Responsibilities

## Core backend modules

### 1. Projects

Responsibilities:

- project CRUD
- project classification
- lifecycle state
- ownership
- location/jurisdiction facts
- project summary

Does not decide approval requirements.

### 2. Organizations

Responsibilities:

- departments
- offices
- organizational hierarchy
- jurisdiction mappings
- positions
- current/previous user-position assignments

### 3. Authority

Responsibilities:

- authority requirements
- authority resolution
- position resolution
- scope checks
- effective-date checks

Returns unresolved state when source-backed authority cannot be established.

### 4. Rules

Responsibilities:

- source registry
- rule versions
- rule validation
- activation/deactivation
- provenance
- conflict detection
- rule evaluation

### 5. Workflows

Responsibilities:

- workflow templates
- workflow versioning
- instances
- node/edge state
- transitions
- dependency evaluation

### 6. Approvals

Responsibilities:

- approval requests
- submit/review/return/reject/approve
- authority requirement binding
- decision records
- approval evidence

### 7. Clearances

Responsibilities:

- conditional/project-specific clearance records
- external authority references
- expiry where applicable
- evidence

### 8. Procurement

Responsibilities:

- tender metadata
- external procurement reference
- tender state synchronization
- evaluation metadata where legally appropriate

Do not recreate Gujarat eProcurement unnecessarily.

### 9. Contractors

Responsibilities:

- contractor profile
- project assignment
- contract relationship
- submission permissions

### 10. Contracts

Responsibilities:

- contract
- award
- securities/insurance references
- contract dates
- DLP configuration

### 11. Construction

Responsibilities:

- work packages
- milestones
- progress updates
- planned vs actual
- site activity

### 12. Inspections

Responsibilities:

- inspection request
- checklist
- inspector assignment
- observations
- pass/fail/return
- evidence

### 13. Measurements

Responsibilities:

- measurement records
- verification
- quantity history
- measurement references

### 14. Billing

Responsibilities:

- bill creation/reference
- measurement links
- technical verification state
- financial processing state
- payment reference

### 15. Issues

Responsibilities:

- hindrance/issue creation
- assignment
- impact
- resolution
- dependency links

### 16. Variations

Responsibilities:

- change request
- cost/time/scope impact
- approval requirements
- versioning

### 17. Documents/Evidence

Responsibilities:

- upload metadata
- versioning
- storage location
- virus scanning hook
- access control
- hash/integrity metadata

### 18. Notifications

Responsibilities:

- task assignment
- reminders
- escalation notices
- in-app notifications
- optional email/SMS integration

### 19. Audit

Responsibilities:

- immutable action history
- before/after snapshots for critical changes
- actor + position + office context
- request ID
- timestamp

### 20. Dashboards

Responsibilities:

- read-optimized project metrics
- blocker views
- approval aging
- milestone variance
- financial summary

Do not duplicate core business logic here.

### 21. AI

Responsibilities:

- retrieval from source registry
- project-context retrieval
- document extraction
- advisory suggestions
- explanation
- anomaly detection assistance
- draft outputs

AI calls core application services only through explicit safe interfaces.

## Module dependency rules

Avoid:

```text
Projects → direct SQL into approvals tables
Approvals → direct SQL into organizations tables
AI → direct mutation of project state
```

Prefer:

```text
Projects → OrganizationService interface
Approvals → AuthorityResolver
Workflow → RuleEvaluator
AI → read APIs / dedicated application services
```

## Example feature ownership

### `Submit Project`

Owned by `projects`.

Invokes:

- validation
- rule evaluation
- workflow generation
- audit
- event publication

### `Approve Technical Sanction`

Owned by `approvals`.

Invokes:

- authority guard
- approval policy
- workflow transition
- audit
- notification

### `Why is project blocked?`

Owned by `workflows`/`dashboards`.

Dependency engine computes the blocker. AI may summarize/explain it.

## API naming

Prefer resource-oriented routes:

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
POST   /api/v1/projects/:id/submit
GET    /api/v1/projects/:id/workflow
GET    /api/v1/projects/:id/blockers
GET    /api/v1/projects/:id/approvals
POST   /api/v1/approvals/:id/submit
POST   /api/v1/approvals/:id/decision
```

Actions are permitted where they represent state transitions rather than arbitrary CRUD.

## Frontend feature ownership

Frontend modules mirror domain areas but are not required to mirror backend folders exactly.

Use:

```text
features/projects
features/approvals
features/workflow
features/construction
features/inspections
features/rules
features/ai-copilot
```

Shared UI remains generic.
