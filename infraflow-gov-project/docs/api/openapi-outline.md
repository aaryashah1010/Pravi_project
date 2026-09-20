# OpenAPI Outline

OpenAPI 3.1 should be generated from backend decorators/schema where practical.

## Tags

- Auth
- Projects
- Workflow
- Approvals
- Documents
- Milestones
- Inspections
- Measurements
- Bills
- Issues
- Changes
- Contractors
- Organization
- AuthorityRules
- RuleSources
- AI
- Reports
- Audit

## Standard response envelope

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

## Pagination

Use cursor or page/limit consistently. Prefer cursor pagination for audit/activity feeds.

## Authorization errors

```text
401 UNAUTHENTICATED
403 INSUFFICIENT_SCOPE
409 STATE_CONFLICT
422 RULE_NOT_VERIFIED
422 AUTHORITY_NOT_RESOLVED
```

## Workflow conflict example

If two people try to approve a node at once, return `409 STATE_CONFLICT` and retain both attempts in audit metadata.

## Rule-not-verified example

```json
{
  "error": {
    "code":"RULE_NOT_VERIFIED",
    "message":"The system cannot automatically determine the required authority for this approval because no verified rule is configured for the project's scope.",
    "requestId":"..."
  }
}
```
