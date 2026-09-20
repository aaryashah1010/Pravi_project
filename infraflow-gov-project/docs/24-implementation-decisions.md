# 24 — Implementation Decisions

## D-001 — React + Node + Docker

Decision: use React + TypeScript frontend, Node.js + TypeScript backend, Docker for reproducible deployment.

Reason: fast development, clear separation, strong ecosystem and deployment simplicity.

## D-002 — Modular monolith first

Decision: one backend application with modules.

Reason: this project has many domain entities and transactional workflow state; microservices would add unnecessary deployment complexity for the prototype.

## D-003 — PostgreSQL

Decision: PostgreSQL as source of truth.

Reason: relational integrity, JSONB for rule conditions, good transactional semantics, full text/vector options and strong SQL support.

## D-004 — Rule engine is deterministic

Decision: mandatory government workflow rules are executed by code/configuration, not generated live by an LLM.

Reason: explainability, auditability and source provenance.

## D-005 — AI is advisory

Decision: AI may explain/recommend/detect/draft but cannot exercise approval authority.

## D-006 — No person-hardcoded routing

Decision: route by position + office + jurisdiction + authority profile, then resolve current holder.

## D-007 — No unverified rules

Decision: rule status controls whether a rule can execute.

`UNVERIFIED` rules cannot block/route/approve automatically.

## D-008 — Existing government systems are integration points

Decision: eProcurement and generic workflow/document systems are referenced/integrated rather than reimplemented.

## D-009 — Rule provenance is first-class

Decision: every executable rule has a source, citation, scope, effective period, status and reviewer metadata.

## D-010 — Historical reproducibility

Decision: a project workflow instance stores the rule versions used to generate it.

Reason: rules may change later; historical project decisions need reproducible context.

## D-011 — Synthetic demo data

Decision: prototype should use clearly synthetic project/user data.

Reason: avoid presenting fabricated records as real government projects or people.

## D-012 — Public portal is separate

Decision: public access reads only explicitly public fields/documents.

## D-013 — Human-readable error when authority is unresolved

Decision: return a clear manual-review state rather than making an arbitrary assignment.
