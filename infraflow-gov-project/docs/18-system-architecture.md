# 18 — System Architecture

## Target architecture

```text
                         Internet / Intranet
                                 │
                         Reverse Proxy / TLS
                                 │
                    ┌────────────┴────────────┐
                    │                         │
               React Web App             Mobile/PWA
                    │                         │
                    └────────────┬────────────┘
                                 │ HTTPS
                                 ▼
                         Node.js API
                                 │
             ┌───────────────────┼────────────────────┐
             │                   │                    │
             ▼                   ▼                    ▼
       Auth/Policy         Workflow Service      AI Service
       + RBAC/ABAC         + Rules Engine        + RAG
             │                   │                    │
             └──────────────┬────┴────────────────────┘
                            ▼
                        PostgreSQL
                            │
             ┌──────────────┼───────────────┐
             ▼              ▼               ▼
           Redis        Object Storage   Vector Search
                           /Files          pgvector
                            │
                            ▼
                    External Integrations
                eProcurement / Gov workflow /
                    other department APIs
```

## Service boundaries

Initial deployment can be a modular monolith in Node.js. Do not prematurely split into many microservices.

Recommended modules:

- auth;
- users;
- organizations;
- projects;
- rule registry;
- authority resolution;
- workflow;
- documents;
- procurement;
- contractors;
- monitoring;
- inspections;
- measurements;
- billing;
- issues;
- changes;
- notifications;
- AI;
- audit;
- reporting.

## Why modular monolith first

- easier deployment;
- easier transaction boundaries;
- faster development;
- less operational complexity;
- Docker-friendly;
- can later extract heavy modules if required.

## Event model

Use domain events internally:

- ProjectCreated
- RuleWorkflowGenerated
- ApprovalSubmitted
- ApprovalDecided
- TaskAssigned
- MilestoneUpdated
- InspectionCompleted
- IssueRaised
- IssueResolved
- ChangeRequested
- ContractAwarded
- WorkOrderIssued
- ProjectCompleted
- HandoverRecorded

Events are used for notifications/audit/analytics, not as a substitute for transactional state updates.
