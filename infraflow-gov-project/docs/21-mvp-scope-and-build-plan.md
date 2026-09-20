# 21 — MVP Scope and Build Plan

## MVP objective

Demonstrate a credible, source-backed government infrastructure workflow platform without pretending to implement every Gujarat government rule.

## Phase 1 — Foundation

- React app shell;
- Node.js API;
- PostgreSQL;
- Docker Compose;
- authentication;
- RBAC/ABAC base;
- organization/office/position model;
- audit events.

## Phase 2 — Rule registry

- source catalog;
- rule source uploads/metadata;
- rule versions;
- verification status;
- scope/conditions;
- authority rule structure;
- workflow rule structure.

## Phase 3 — Project workflow

- create government-building project;
- enter project facts;
- generate workflow from verified + conditional rules;
- visualize graph;
- assign tasks by position;
- approval actions;
- source provenance.

## Phase 4 — Construction monitoring

- milestones;
- progress;
- inspection requests;
- field evidence;
- issues/hindrances;
- measurements placeholder;
- contractor access.

## Phase 5 — Control tower

- blocker detection;
- overdue actions;
- SLA dashboard;
- downstream impact;
- project timeline;
- portfolio dashboard.

## Phase 6 — AI

Implement:

1. Explain approval.
2. Explain blocker.
3. Recommend next actions.
4. Document field extraction.
5. Detect project-data inconsistencies.

All AI outputs are source-grounded and advisory.

## Phase 7 — Public portal

- search project;
- view public status;
- view public progress;
- publish selected public milestones.

## Seed project

Use a fictional prototype project clearly labeled `DEMO / NOT A REAL GOVERNMENT PROJECT`.

Example:

```text
Project: Demo Government School Building
Department: Demo Education Department
Location: Ahmedabad District / Demo Taluka
Estimated value: INR 12 Cr
```

The value and project are synthetic and must not be presented as an actual government project.

## Seed users

Create synthetic accounts:

- project.officer@demo.local
- engineer@demo.local
- approving.authority@demo.local
- monitoring@demo.local
- field.inspector@demo.local
- contractor@demo.local
- admin@demo.local

Clearly mark as demo accounts.

## Build priority

P0:

- rule provenance;
- organization/authority model;
- project/workflow graph;
- approval action;
- blocker detection;
- audit trail;
- Docker deployment.

P1:

- inspection/evidence;
- contractor portal;
- public portal;
- AI explanation.

P2:

- advanced procurement integration;
- advanced financial integration;
- computer vision;
- predictive schedule analytics;
- external identity federation.
