# 04 — Stakeholders and Users

## Stakeholders

Stakeholders can include:

1. Administrative department.
2. Engineering organization.
3. Competent/approving authorities.
4. Finance/budget function.
5. Procurement function.
6. Land/site-related authorities.
7. Statutory clearance authorities when applicable.
8. Field engineers/inspectors.
9. Contractor and subcontractor teams.
10. Senior management.
11. Audit/inspection functions.
12. Receiving/operating department.
13. Citizens/public users.
14. Existing government digital systems integrated through APIs/references.

## Active application users

### 1. Project Officer / Initiator

Creates and manages project proposals, uploads project documents, starts configured workflows, responds to comments.

### 2. Technical User / Engineer

Reviews technical packages, performs technical tasks, records technical observations, participates in inspections and measurements.

### 3. Competent Approving Authority

Acts on approvals within their authorized position/scope; can approve, reject, return, request clarification, or record a decision as allowed by policy.

### 4. Senior / Portfolio Authority

Sees cross-project dashboards, escalations, project risk, outstanding actions and exception reports within their scope.

### 5. Monitoring / Project Control Officer

Monitors milestones, dependencies, delays, bottlenecks, SLA breaches, contractor performance data and evidence completeness.

### 6. Field Engineer / Inspector

Uses mobile/web interface for site visits, inspections, photos, GPS metadata, checklists, measurements and observations.

### 7. Contractor / Agency

External user with restricted access to assigned projects/work packages; can submit progress, documents, clarifications and responses.

### 8. System / Department Administrator

Maintains users, positions, offices, authority configuration, rule sources, workflow templates and system settings.

## Public user

Citizens are not internal workflow users. Provide a read-only public portal exposing only data marked public.

## Access model

Do not encode authorization as `role = Executive Engineer` alone.

Use:

```text
User
  ↓
Position
  ↓
Office
  ↓
Jurisdiction / Scope
  ↓
Department / Organization
  ↓
Authority Profile
  ↓
Project Access
```

## Why this matters

Two users can share the same designation but belong to different offices/jurisdictions. A person can transfer to a different position. The workflow must continue based on the position and office, with the current user resolved at execution time.

## External system stakeholders

The platform should prefer adapters/reference integrations for eProcurement and generic government workflow/document services rather than duplicating them.
