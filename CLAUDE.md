# InfraFlow — Claude Code project memory

Hackathon build. **Speed matters; the user says "just decide".** Full plan: `PLAN.md` (progress checklist at §13). Do NOT re-read `infraflow-gov-project/docs/*` — everything needed is distilled in `.claude/context/`.

## What this is
Source-backed workflow + monitoring platform for Gujarat public-works **building** projects. Project facts → versioned **rule registry** → **dependency-graph workflow** → approvals routed to a **position** by an **authority resolver that refuses to guess** → **blocker engine** → construction/inspection/evidence/issues → **advisory AI copilot**. Everything audited.

## Non-negotiables (violating any of these is a bug — `rules-guardian` audits them)
1. **No ORM.** Raw SQL via `pg`. SQL lives only in `*.repo.ts` files and `infraflow-gov-project/db/`. Routes/services never import `pg`.
2. **No invented government rules.** Never hard-code authority thresholds, clauses, citations, SLAs-as-law. Rules come from `rule_versions` (+`rule_sources`, `rule_citations`). Unknown ⇒ `Not verified` / `MANUAL_REVIEW`, never a guess. The only monetary thresholds that exist are the **synthetic DEMO-GOV matrix** (labelled SYNTHETIC in DB + UI).
3. **A rule is executable iff** `enforcement_mode='ENFORCEABLE' AND verification_status='VERIFIED' AND effective dates cover today`. Non-executable rules can never block/route/approve.
4. **AI is advisory only.** No code path from AI to approvals, rules, workflow or project state. Outputs always `requires_human_review:true`, cite only rules present in the supplied context.
5. **Route by position, not person.** Task → position (+office); current holder resolved at read time via `v_current_position_holders`. Never route by designation name alone.
6. **Same-transaction audit + outbox.** Every business mutation: state change + `audit_logs` + `domain_events` (+`workflow_transitions`/`approval_decisions` where relevant) in ONE `withTx`. Append-only tables (`audit_logs`, `approval_decisions`, `variation_decisions`, `workflow_transitions`, `domain_events`) are never updated/deleted (events only get `published_at`).
7. **Synthetic data only.** No real officer names. `DEMO DATA` chip on every screen. Don't port fabricated text from `Ui/*/code.html` (fake clauses, "SHA-256 validated", "L3 Authority", real-sounding names).
8. Concurrency: optimistic `version_no` (projects, tasks) and `SELECT … FOR UPDATE` on approval decisions → `409 STATE_CONFLICT`.

## Stack & ports
Node 22 · npm workspaces (no pnpm) · Fastify + TS + zod (`apps/api`, :4000) · React + Vite + TS + Tailwind + TanStack Query + React Router + `@xyflow/react`+dagre (`apps/web`, :5173) · Postgres 17 in Docker (`infraflow-db`, host :5455) · local-disk uploads (`storage_provider='LOCAL'`) · OpenAI gateway with deterministic fallback. Prod compose web on :8088. Dropped on purpose: Redis, MinIO, Nginx container, pgvector, NestJS, CI.

## Commands
```
npm run db:up        # docker compose up -d db
npm run db:migrate   # apply infraflow-gov-project/db/migrations (tracked in _migrations) + views
npm run db:seed      # idempotent seeds + demo password hashes
npm run db:reset     # DEV ONLY: drop schema, migrate, seed
npm run dev          # api + web
npm test             # vitest (domain + DB integration on infraflow_test)
npm run demo:e2e     # scripted API storyline with assertions
npm run typecheck
```
Env: copy `.env.example` → `.env`. Demo password for all personas: `Demo@12345`.

## Repo map
```
apps/api/src/{server,config}.ts · platform/{db,tx,audit,events,errors,context,clock}.ts
apps/api/src/modules/<name>/{<name>.routes.ts,<name>.service.ts,<name>.repo.ts,domain/*.ts}
apps/web/src/{app,components/{shell,ui,graph},features/*,lib}
packages/shared/src   zod schemas = API contract (both sides import @infraflow/shared)
infraflow-gov-project/db/{migrations,seeds,queries,views}   docs/ (read-only reference)
Ui/                   Stitch exports (design reference) · scripts/ (db + demo scripts)
```
Module rules: pure domain logic (rule DSL, blocker analyzer, resolver decision fn) has **no HTTP/DB imports** and is unit-tested; cross-module calls go through the other module's *service*.

## Conventions
- API: `/api/v1`, envelope `{data, meta:{requestId}}`; errors `{error:{code,message,requestId,fieldErrors?,sourceRuleId?}}` with codes `UNAUTHENTICATED 401, INSUFFICIENT_SCOPE 403, VALIDATION_ERROR 400, NOT_FOUND 404, STATE_CONFLICT 409, RULE_NOT_VERIFIED 422, AUTHORITY_NOT_RESOLVED 422`.
- Every service fn takes `ctx: RequestContext {actor, requestId, now}`; use `ctx.now` (not `new Date()`/`now()`) for business timestamps so the scenario seeder can backdate.
- Money = `NUMERIC(18,2)` → strings/decimal in JS, never floats. Timestamps `TIMESTAMPTZ`.
- Migrations 001–022 are FROZEN. Changes go in `023+`. Seeds must be idempotent (`ON CONFLICT … DO NOTHING`; partial unique indexes need their `WHERE`).
- Comments: only for non-obvious WHY. No emojis in code/UI.

## Context files (read on demand)
- @.claude/context/domain-cheatsheet.md — tables/enums/state machines/resolver/template/routes→permissions/personas
- @.claude/context/design-system.md — tokens, components, Stitch→route map, port rules
- @.claude/context/demo-script.md — 6-minute storyline + seeded scenarios

## Agents (`.claude/agents/`)
`db-engineer` (db/**, scripts/db-*) · `api-engineer` (apps/api/**) · `web-engineer` (apps/web/**) · `rules-guardian` (read-only audit) · `demo-qa` (runs e2e + browser). Slash commands: `/db-reset /demo-e2e /rules-audit /slice-status`.

## Working agreements
- Vertical slices; finish a slice (API + UI + e2e assertion) before starting the next. Tick `PLAN.md` §13 as slices complete.
- Never commit/push unless the user asks. `git init` exists; no commits yet.
- UI work is not "done" until exercised in a browser (type-check ≠ feature works).
