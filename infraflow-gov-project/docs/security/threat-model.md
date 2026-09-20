# Threat Model

## Threat 1 — Unauthorized approval

Mitigation:
- server-side authority resolution;
- role + scope checks;
- immutable audit;
- no client-trusted role flags.

## Threat 2 — Rule tampering

Mitigation:
- admin permission;
- versioning;
- audit;
- source hash;
- publication workflow.

## Threat 3 — AI prompt injection via uploaded documents

Mitigation:
- treat document text as untrusted input;
- strip/segregate instructions from data;
- tool allowlist;
- source filtering;
- no direct privilege elevation from AI.

## Threat 4 — Cross-department data leakage

Mitigation:
- every query scoped by organization and project permissions;
- filtered retrieval for AI;
- separate public/internal fields.

## Threat 5 — Contractor access to internal comments

Mitigation:
- separate internal/private and contractor-visible objects/fields.

## Threat 6 — Duplicate approval submission

Mitigation:
- optimistic concurrency;
- unique workflow node state;
- idempotency keys.

## Threat 7 — Fake site evidence

Mitigation:
- timestamp metadata where available;
- GPS metadata where appropriate;
- hashes;
- duplicate image detection;
- inspector verification;
- audit trail.

## Threat 8 — File malware

Mitigation:
- extension + MIME verification;
- size limits;
- malware scanning;
- object storage isolation;
- download content-disposition controls.

## Threat 9 — Stale rules

Mitigation:
- effective dates;
- supersession metadata;
- rule-version reference stored on workflow instances;
- scheduled source review.
