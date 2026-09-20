# 06 — Approval Engine

## Goal

Determine which approval/sanction steps apply to a project, generate them with dependencies, resolve the competent authority, and track the decision.

## Approval object

```text
Approval
- id
- project_id
- approval_type
- status
- required_by_rule_id
- authority_requirement_id
- assigned_position_id
- assigned_user_id
- submitted_at
- decision_at
- decision
- decision_reason
- source_document_id
- created_from_rule_version
```

## Decision lifecycle

```text
NOT_STARTED
  ↓
READY
  ↓
SUBMITTED
  ↓
UNDER_REVIEW
  ├── APPROVED
  ├── REJECTED
  └── RETURNED
```

`RETURNED` means correction/resubmission rather than final rejection.

## Approval discovery

Inputs may include:

- department;
- project type;
- work type;
- location/jurisdiction;
- estimated cost;
- land/site attributes;
- building characteristics where relevant;
- funding source;
- applicable program/scheme;
- contract/procurement type;
- other source-backed conditions.

Outputs:

- required approvals;
- conditional approvals to check;
- authority role/position requirement;
- required documents;
- dependency relationships;
- source provenance.

## Approval readiness

A decision request should be created only when configured mandatory prerequisites are complete.

Example:

```text
Technical Sanction

Prerequisites:
- detailed estimate present
- required design package present
- relevant review tasks completed
```

Do not add such prerequisites unless the selected rule package supports them.

## Source provenance on every rule-generated approval

Display:

- rule ID;
- source document;
- issuing department/authority;
- clause/section/page if available;
- publication date;
- effective date;
- superseded date if any;
- scope;
- verification status.

## Human decision requirement

The system records the authorized person's decision. AI cannot approve, reject, or alter an official decision without human action through an authorized workflow.

## Approval explanation

AI may provide:

> Why is this approval required?

> Which project fact triggered it?

> What prerequisites are missing?

> Which downstream activities are affected?

The explanation must link to the rule source.
