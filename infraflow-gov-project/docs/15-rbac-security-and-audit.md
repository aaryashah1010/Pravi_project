# 15 — RBAC, Security and Audit

## Authorization model

Use RBAC + ABAC/scope checks.

RBAC determines capabilities.

ABAC/scope determines which resources the user can act on.

Example:

```text
Capability: APPROVAL.REVIEW
Scope:
Department = R&B
Jurisdiction = Ahmedabad Division
ProjectType = Government Building
AuthorityProfile = matching profile
```

## Security principles

- least privilege;
- deny by default;
- project/office scoping;
- separate internal and contractor views;
- public data explicitly classified;
- immutable audit entries;
- short-lived access tokens;
- secure refresh-token handling;
- encryption in transit and at rest where available;
- malware/file validation;
- rate limiting;
- request correlation IDs;
- backup and recovery.

## Audit event

```text
AuditEvent
- id
- actor_user_id
- actor_position_id
- action
- target_type
- target_id
- timestamp
- request_id
- old_state
- new_state
- reason
- source_ip_metadata if permitted
```

Avoid storing unnecessary personal data in logs.

## Approval audit

For every official decision record:

- actor;
- actor's position at decision time;
- applicable authority profile/rule;
- decision time;
- decision;
- reason where required;
- evidence/document references;
- workflow state before/after.

## Rule changes

Rule updates require elevated authorization and their own audit trail.

Never edit a rule in place if doing so would destroy historical interpretation. Create a new version and mark the older version superseded when appropriate.

## Sensitive data

Contractor credentials, staff information, documents and internal comments must be separated from public fields.

## Tenant/department boundary

For a single-state deployment, logical department isolation is still required. A user should not gain visibility just because two projects share a geographic location.

## Threats

See `docs/security/threat-model.md` for abuse cases and mitigations.
