# 17 — API Design

## API style

REST JSON for the main application API.

GraphQL can be considered later for complex dashboard aggregation, but REST is simpler for the initial deployment.

## Auth

```http
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Projects

```http
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
GET    /api/v1/projects/:id/timeline
GET    /api/v1/projects/:id/graph
```

## Workflow

```http
POST /api/v1/projects/:id/workflow/generate
GET  /api/v1/projects/:id/workflow
POST /api/v1/workflow/nodes/:nodeId/start
POST /api/v1/workflow/nodes/:nodeId/complete
POST /api/v1/workflow/nodes/:nodeId/return
```

## Approvals

```http
GET  /api/v1/approvals
GET  /api/v1/approvals/:id
POST /api/v1/approvals/:id/submit
POST /api/v1/approvals/:id/approve
POST /api/v1/approvals/:id/reject
POST /api/v1/approvals/:id/return
```

Approval endpoints must perform an authority/scope check server-side.

## Documents

```http
POST /api/v1/projects/:id/documents/presign
POST /api/v1/projects/:id/documents/complete
GET  /api/v1/documents/:id
GET  /api/v1/documents/:id/download
```

## Inspections

```http
POST /api/v1/projects/:id/inspections
GET  /api/v1/projects/:id/inspections
POST /api/v1/inspections/:id/start
POST /api/v1/inspections/:id/submit
```

## Milestones

```http
GET   /api/v1/projects/:id/milestones
POST  /api/v1/projects/:id/milestones
PATCH /api/v1/milestones/:id
```

## Issues

```http
GET  /api/v1/projects/:id/issues
POST /api/v1/projects/:id/issues
PATCH /api/v1/issues/:id
POST /api/v1/issues/:id/resolve
```

## Changes

```http
GET  /api/v1/projects/:id/changes
POST /api/v1/projects/:id/changes
POST /api/v1/changes/:id/submit
POST /api/v1/changes/:id/approve
```

## Rules

```http
GET  /api/v1/rules
GET  /api/v1/rules/:id
GET  /api/v1/rules/:id/source
POST /api/v1/admin/rules
POST /api/v1/admin/rules/:id/publish
POST /api/v1/admin/rules/:id/supersede
```

Publishing rules requires privileged authorization and audit logging.

## Organization

```http
GET /api/v1/offices
GET /api/v1/positions
GET /api/v1/users
GET /api/v1/authority-profiles
```

## AI

```http
POST /api/v1/ai/explain-project
POST /api/v1/ai/next-actions
POST /api/v1/ai/analyze-blocker
POST /api/v1/ai/check-document
POST /api/v1/ai/draft-summary
```

AI endpoints return structured source/rule references and `requires_human_review`.

## Idempotency

Write endpoints that create workflow actions/documents should accept:

```http
Idempotency-Key: <uuid>
```

## Errors

Use stable codes:

```json
{
  "error": {
    "code": "AUTHORITY_NOT_FOUND",
    "message": "No verified competent-authority rule is configured for this project state.",
    "requestId": "..."
  }
}
```

Never fabricate a routing decision when `AUTHORITY_NOT_FOUND` occurs.
