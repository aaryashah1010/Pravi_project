# 12 — Change, Hindrance and Delay Management

## Hindrance

A hindrance is an issue/event that prevents or interferes with planned work.

Official Gujarat civil specifications include a Hindrance Register among site records.

## Issue object

```text
Issue
- id
- project_id
- category
- title
- description
- severity
- raised_by
- owner_position_id
- owner_user_id
- opened_at
- due_at
- resolved_at
- status
- impact_type
- evidence_id
```

## Categories

Examples for the product model:

- land/site;
- design;
- approval;
- procurement;
- utility;
- material;
- labour;
- weather;
- contractor;
- quality;
- finance;
- safety;
- other.

These categories are product taxonomy, not legal classifications.

## Change Request / Variation

```text
ChangeRequest
- id
- project_id
- reason
- scope_delta
- cost_delta
- schedule_delta
- technical_delta
- requested_by
- review_status
- approval_workflow_id
- decision
- source_rule_id
```

## Change workflow

```text
Request
 ↓
Impact analysis
 ↓
Technical review
 ↓
Financial/cost review
 ↓
Determine whether additional/revised sanction is required
 ↓
Required approval(s)
 ↓
Approve / Reject / Return
 ↓
Update controlled baseline
```

Whether a change requires revised approval must be determined by an official applicable rule/delegation. The application should not infer a universal threshold.

## Root-cause delay analysis

A delay view should distinguish:

- current blocker;
- historical delay event;
- responsibility/owner;
- dependency path;
- actual impact.

AI can summarize causes but should not assign blame or make punitive determinations automatically.
