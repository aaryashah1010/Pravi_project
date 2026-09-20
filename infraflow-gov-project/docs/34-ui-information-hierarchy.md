# 34 — UI Information Hierarchy

## Primary user question

The first screen should answer:

> What needs attention right now?

## Second question

> Why is it blocked or delayed?

## Third question

> Who needs to act?

## Fourth question

> What evidence or source supports the next step?

## Dashboard hierarchy

```text
1. Critical blockers
2. Pending approvals
3. Overdue tasks
4. Project risk
5. Physical/financial progress
6. Upcoming milestones
7. Recent activity
```

Do not lead with decorative charts.

## Project page hierarchy

```text
Project identity
↓
Current state
↓
Root blocker / next action
↓
Workflow graph
↓
Approvals
↓
Construction progress
↓
Evidence
↓
Finance
↓
Issues/variations
↓
Audit
```

## Role-aware navigation

### Department officer

Focus: projects, proposals, documents, approvals, tasks.

### Technical officer/field engineer

Focus: assigned projects, inspections, milestones, evidence.

### Approving authority

Focus: approval inbox, prerequisites, source/rule evidence, decision history.

### Senior/monitoring officer

Focus: portfolio, blockers, aging, escalations, progress and finance.

### Contractor

Focus: assigned contracts/projects, milestones, submissions, observations.

### Administrator

Focus: organizations, positions, rules, workflows, source registry, audit.

## Trust indicators

Every rule-backed UI item should make its provenance discoverable.

Use status labels such as:

`Verified source`
`Conditional`
`Contract-specific`
`Unverified`
`Superseded`

Do not use confidence percentages to represent legal certainty.
