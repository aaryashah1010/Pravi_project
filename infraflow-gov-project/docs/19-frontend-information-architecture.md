# 19 — Frontend Information Architecture

## Navigation

```text
Dashboard
Projects
Approvals
My Tasks
Workflow
Inspections
Milestones
Contractors
Documents
Issues & Hindrances
Variations / Changes
Reports
Organization
Authority Rules
Rule Sources
Audit Logs
Settings
```

## Dashboard

The homepage should answer:

1. What needs attention?
2. What is blocked?
3. What is overdue?
4. Which projects are at risk?
5. What can I act on today?

### KPI cards

- active projects;
- blocked projects;
- at-risk projects;
- overdue approvals;
- overdue inspections;
- pending contractor actions;
- financial work/bill summary.

## Project detail page

Sections:

- Overview
- Workflow Graph
- Timeline
- Approvals
- Documents
- Construction Progress
- Milestones
- Inspections
- Measurements
- Bills
- Issues
- Changes
- Contract
- Audit
- AI Copilot

## Workflow Graph UI

Node colors should reflect state, but never rely on color alone.

Show:

- node state;
- owner position;
- current user;
- age;
- source rule badge;
- blockers;
- downstream impact.

## Approval screen

```text
Approval
Status
Authority
Submitted
SLA
Required evidence
Decision history
Source rule
[Approve]
[Return]
[Reject]
```

## AI panel

Show recommendations with:

- reason;
- facts used;
- source links;
- confidence;
- human-review flag.

## Public portal

Read-only project search:

- Project name;
- location;
- public cost/value where approved for publication;
- public progress;
- public milestone status;
- planned/actual date fields designated public;
- public documents.

Default is privacy-first: internal data is never public unless explicitly classified public.
