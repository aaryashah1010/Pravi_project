# Production Deployment Checklist

## Infrastructure

- Linux host hardened.
- Docker installed and patched.
- Firewall configured.
- TLS certificate configured.
- Domain configured.
- Backups configured.
- Restore procedure tested.

## Containers

- Images pinned.
- Non-root containers where supported.
- Resource limits configured.
- Health checks configured.
- Secrets not committed to Git.

## Database

- PostgreSQL version tested.
- Automated backups.
- Point-in-time recovery where appropriate.
- Migrations versioned.
- Connection pooling configured.
- No public database port.

## Security

- Secure cookies or token storage.
- CSRF protection if cookie-authenticated.
- CORS restricted.
- Rate limits.
- File upload validation.
- Virus/malware scanning for high-risk file workflows.
- Audit logging.
- Access review.

## AI

- API keys in secret store.
- PII/document classification.
- Prompt injection defenses for document content.
- Source retrieval filters by user permissions.
- AI output marked advisory.
- No private document leakage across departments.

## Rule registry

- Every active rule has source provenance.
- Effective dates verified.
- Superseded rules disabled for new decisions.
- Rules tested against fixtures.
- Manual-review path works.

## Monitoring

- Error tracking.
- API latency.
- DB health.
- Queue health.
- Storage availability.
- AI latency/cost/error metrics.
