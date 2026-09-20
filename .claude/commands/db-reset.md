---
description: Reset and reseed the InfraFlow dev database (drops all data)
---
Run `npm run db:up` then `npm run db:reset`, then run it a second time to prove idempotency. Report per-step success and the row counts of: app_users, roles, organizations, offices, positions, rule_sources, rule_versions, authority_rules, workflow_templates, workflow_node_templates. If anything fails, show the exact SQL error and the migration/seed file responsible.
