# InfraFlow — Hackathon Build Plan (single source of truth)

> Written for: you (product owner) and every future Claude session on this repo. On approval, step 0 copies this file to `D:\Projects\Pravi\PLAN.md` and distills it into `CLAUDE.md` + `.claude/` so nobody re-reads the 50 docs again.

## 1. Context

**What we're building.** InfraFlow: a source-backed workflow + monitoring layer for Gujarat public-works building projects. A project's facts (department, type, cost, jurisdiction, site attributes) are run through a **versioned rule registry** to generate a **dependency-graph workflow**. Approvals are routed to a **position** (not a person) by an **authority resolver** that refuses to guess. A **blocker engine** shows the root blocker and its downstream impact. Construction/inspection/evidence/issues feed back into the graph. An **advisory AI copilot** explains everything with rule citations. Everything is audited, append-only where required.

**Why this plan.** Hackathon = ruthless focus on a *demoable vertical slice*, not doc-completeness. Your docs + SQL are excellent but describe far more than we can build; this plan picks the shortest path to the most impressive, honest demo and marks cut-lines.

**What's already there (verified by reading it all):** 51 design docs, 22 raw-SQL migrations (~85 tables), 4 seed files, 7 query files, 1 view file, 5 Stitch UI exports (`Ui/`: control center, project detail, workflow graph, field inspection, logo) + `DESIGN.md` design system. **No application code exists yet.**

**Decisions locked (yours + mine):**

| Topic | Decision |
|---|---|
| Authority in demo | **Both paths**: synthetic `DEMO-GOV` delegation matrix (clearly labelled *SYNTHETIC DEMO — not a real rule*) makes the happy path route end-to-end; the real R&B department has **no** delegation → `MANUAL_REVIEW`. Honesty is a feature. |
| AI | **OpenAI** behind a provider-agnostic gateway + **deterministic offline fallback** (demo never breaks without key/Wi-Fi). |
| Stack | **Lean**: Fastify + TypeScript API (docs allow it), React + Vite + TS + Tailwind web, raw-SQL Postgres 17 in Docker, local-disk file storage, npm workspaces. **Dropped for now:** Redis, MinIO, Nginx (web image bundles its own), pgvector, NestJS, GitHub Actions. Kept: module/repository pattern, outbox, audit, optimistic locking, "no ORM". |
| Repo root | `D:\Projects\Pravi` is the monorepo root. `infraflow-gov-project/` (docs + `db/`) stays as the docs/DB source of truth; `Ui/` stays as design reference. |
| Auth | Email + shared demo password + JWT (HS256, 8h). Login screen has one-click **persona buttons**. Server computes roles/positions every request; client flags never trusted. |
| Ports (checked free) | Postgres `5455`, API `4000`, web dev `5173`, prod web `8088`. (5432/5433/8080/3000 are taken on this machine.) |
| Tooling | Node 22, npm 10 (no pnpm), Docker 28 running, git present. |

## 2. Findings from the read — gaps I must fix (cheap now, expensive later)

These are defects/omissions in the existing SQL/seeds that would break the build or the safety story. All fixed in **new** migration `023_hackathon_gaps.sql` + new seeds (files 001–022 stay frozen).

1. **No credentials.** `app_users` has no password column → add `password_hash`.
2. **No user↔contractor link.** `contractors` ↔ `app_users` isn't modelled, so contractor-scoped access is impossible → add `contractor_users(contractor_id, user_id)`.
3. **Outbox is broken by our own trigger.** `022` makes `domain_events` fully immutable, but publishing needs `UPDATE published_at` → replace with a trigger that forbids DELETE and forbids UPDATE of anything except `published_at` / `publication_attempts`.
4. **`document_versions UNIQUE(sha256)` is global** → same photo on two projects (or re-uploading in a demo) errors → replace with `UNIQUE(document_id, sha256)`.
5. **Seed `004` fails as written.** `ON CONFLICT (external_subject)` targets a *partial* unique index without its `WHERE` predicate → Postgres error. Also it seeds no user↔role, no user↔position, and no project despite its filename. → rewrite 004; add 005+.
6. **Authority candidate query (`queries/001`) is unsafe.** It checks `authority_rules.status='ACTIVE'` but never joins `rule_versions` to require `ENFORCEABLE` + `VERIFIED` + effective dates, and it ignores `routing_scope`/jurisdiction. Our resolver SQL adds both.
7. **Root-blocker query (`queries/002`) treats `NOT_APPLICABLE`/`SKIPPED` predecessors as blockers forever** (their `execution_state` never becomes COMPLETED) and returns every incomplete predecessor, not the *root*. Our analyzer marks dependencies of N/A nodes `DISABLED` at generation and ranks only **frontier** nodes.
8. **Cost-band boundary trap.** Authority bands use inclusive `>= min` and `<= max`; two bands sharing a boundary both match at exactly that value → `AMBIGUOUS`. Seed upper bands start at `max + 0.01`.
9. **Add `project_code_seq`** (`INF-2026-00001` style) and a few permissions (`document.upload`, `document.verify`, `issue.manage`, `milestone.update`, `ai.use`, `authority.manual_assign`) + role mappings.
10. **Fabricated content in the Stitch screens must NOT be ported**: fake rule clauses ("Rule 18-B", "Ch. IV §12.3", "Form 14-A"), "SHA-256 validated" audit feed, "L3 Authority", real-sounding officer names, fake node IDs. Doc 30 explicitly forbids fake citations. All provenance text comes from the DB; unknown ⇒ "Not verified".

Other observations (no fix needed, just awareness): `010`/`022` use non-idempotent `ADD CONSTRAINT` (our migration runner tracks applied files, so fine); `workflow_instances.project_id` and `contracts.project_id` are UNIQUE (one workflow, one contract per project — matches MVP); `approval_cases.workflow_node_instance_id` is UNIQUE (resubmission after RETURN reuses the same case).

## 3. THE BUILD FLOW (the order we code in)

Vertical slices — every slice ends demoable. Steps 0–7 = **core demo**; stop anywhere after 7 and you still have a winner.

| # | Step | Size | Ends with |
|---|---|---|---|
| 0 | **Scaffold + context files.** Monorepo, `docker-compose` Postgres, `.env`, migrate/seed runner, `CLAUDE.md`, `AGENTS.md`, `.claude/{agents,commands,context,settings.json}`, `git init` (no commits). | S | `npm run db:up && npm run db:migrate` passes on empty DB |
| 1 | **DB truth.** Run 001–022 clean → `023` fixes → seeds 005+ (reference, org/jurisdictions/positions/assignments, roles/perms, **rule registry pack**, **synthetic authority matrix**, **GOV_BUILDING workflow template**, doc types, inspection template) → seed runner (bcrypt hashes) → DB tests. | M | `npm run db:reset` idempotent; DB tests green |
| 2 | **API skeleton.** Fastify bootstrap, error envelope, request context (`actor`, `requestId`, `now`), auth (login/me), permission + scope guards, `withTx` + `audit()` + `emit()` helpers, org module, rules read + provenance module. | M | `GET /auth/me`, `/rules/:id/provenance` work |
| 3 | **Slice 1a — project → rules → workflow.** Create project (+site, proposal v1, budget, members) → `submit` → **rule DSL evaluator** → `rule_evaluations` → **workflow generator** → instance/nodes/dependencies/required docs. | L | Create project via API ⇒ 19-node graph with N/A + conditional-pending nodes |
| 4 | **Slice 1b — authority + approvals + tasks.** Authority resolver, approval cases, submit/decide (approve/return/reject/request-info), engine `recompute` (unlock downstream, spawn tasks), notifications via outbox dispatcher. | L | `scripts/demo-e2e.ts` walks AA→TS→… via API and asserts |
| 5 | **Blockers + control tower.** Blocker analyzer (frontier + recursive downstream), issues↔nodes, SLA/overdue ticker, dashboard endpoints. | M | `/dashboard/*`, `/projects/:id/blockers` correct |
| 6 | **Web shell + Slice 1 UI.** Tailwind tokens from Stitch, AppShell, Login/personas, Control Center, Projects list + create, Project detail (Overview/Approvals), Approvals inbox + decision drawer, My Tasks. | L | Log in as officer → create project → log in as approver → approve, all in browser |
| 7 | **Workflow graph + provenance.** React Flow + dagre custom nodes, blocker drawer, rule provenance panel, lifecycle pipeline. | M | **CORE DEMO COMPLETE** |
| 8 | **Construction + evidence.** Milestones, contractor progress, inspections (tablet UI, GPS, photo), documents/evidence upload (local disk + sha256), issues/hindrances, **scenario seeder** (drives real engine with backdated `now`). | L | Blocked-site + failed-inspection scenarios live |
| 9 | **AI Copilot.** Gateway (OpenAI + deterministic), context builder, guardrail validator, panel UI with citations. | M | "Why is this blocked?" answered with rule citations |
| 10 | **Admin/audit/extras.** Org tree, authority matrix + rule registry UI (manual-review assign), audit timeline, real-R&B "honesty" scenario, public portal, variations. | M–L | (cut-line items) |
| 11 | **Ship.** Full `docker compose up` (db+api+web), demo script rehearsal, README, `db:reset`. | S–M | One-command demo on a clean machine |

**Parallelism rule:** once step 4 is green and `packages/shared` holds the zod API contracts, run the **web-engineer** agent on step 6–7 while I continue steps 5/8 on the API.

## 4. Repo layout

```
D:\Projects\Pravi\
├── CLAUDE.md  AGENTS.md  PLAN.md  .env.example  docker-compose.yml  package.json (workspaces)
├── .claude\   agents\ commands\ context\ settings.json
├── apps\api\  src\{server.ts, config.ts, platform\{db,tx,audit,events,errors,context,clock,logger}.ts,
│              modules\{auth,org,rules,authority,projects,workflows,approvals,tasks,construction,
│                       inspections,issues,documents,dashboards,audit,notifications,ai,admin,public}\
│                       {*.routes.ts, *.service.ts, *.repo.ts (all SQL lives here), domain\*.ts}}
├── apps\web\  src\{app\, components\{shell,ui,graph}\, features\{auth,dashboard,projects,approvals,
│              workflow,construction,inspections,issues,documents,audit,copilot,admin}\, lib\}
├── packages\shared\  zod schemas + DTO types (API contract) + enums mirrored from SQL CHECKs
├── infraflow-gov-project\  (docs + db\{migrations,seeds,queries,views})  ← db files live here
├── Ui\  (Stitch exports, read-only reference)
└── scripts\  db-migrate.ts  db-seed.ts  db-reset.ts  seed-scenarios.ts  demo-e2e.ts
```

Hard rules (from docs 27/29/43): no controller/route touches `pg`; SQL only in `*.repo.ts`; pure domain logic (rule DSL, blocker analyzer, resolver decision function) has **no HTTP/DB imports** and is unit-tested; cross-module calls go through the other module's service, not its tables.

## 5. Engine design (the heart — build exactly this)

### 5.1 Rule executability (one function, used everywhere)
A `rule_version` is **executable at date D** iff `enforcement_mode='ENFORCEABLE' AND verification_status='VERIFIED' AND effective_from ≤ D ≤ effective_to (nullable)`. (DB already forbids ENFORCEABLE unless VERIFIED.)
- Node with executable rule ⇒ **required + gating** (edges keep BLOCKING/REQUIRES_COMPLETION).
- Node with `ADVISORY_ONLY`/non-executable rule ⇒ `gateKind=ADVISORY`: shown with "Not verified / currency check required"; it keeps its process order (edges are template structure) but is never called a mandatory gate and no legal requirement/authority is derived from it. (Refined during build: downgrading edges would have broken TENDER→CONTRACT ordering.)
- Node with **no** rule (operational structure) ⇒ labelled "Configured prerequisite", never "legal".
- Engine outcomes surfaced verbatim from doc 39: `ALLOWED | BLOCKED_BY_VERIFIED_RULE | REQUIRES_HUMAN_REVIEW | AUTHORITY_UNRESOLVED | RULE_NOT_CONFIGURED | RULE_CONFLICT | SOURCE_OUTDATED_OR_UNKNOWN`.

### 5.2 Rule DSL (pure, JSONB in `activation_condition` / `conditions`)
`{ "all":[…] | "any":[…] | "not":{…} | {"fact":"attributes.local_body_approval_required","op":"eq","value":true} }`, ops `eq neq gt gte lt lte in exists`. Facts flattened from project + site + department code + jurisdiction chain. **Missing fact ⇒ `INDETERMINATE`** (node created as "Conditional — pending verification", never silently N/A). Each rule×project result stored in `rule_evaluations` (`MATCH/NO_MATCH/INDETERMINATE/ERROR`) with an explanation JSON.

### 5.3 Workflow template `GOV_BUILDING_STD` v1 (19 nodes; seeded, ACTIVE)
`PROPOSAL → (BUDGET_PROVISION ∥ SITE_HANDOVER)` · `BUDGET_PROVISION → ADMIN_APPROVAL → DESIGN_ESTIMATE → TECHNICAL_SANCTION → (FUND_ALLOTMENT ∥ LOCAL_BODY_CLEARANCE[conditional] ∥ TENDER_DTP_APPROVAL)` · `TENDER_DTP_APPROVAL → TENDER → CONTRACT` (+`LOCAL_BODY_CLEARANCE → CONTRACT` conditional) · `CONTRACT + FUND_ALLOTMENT → WORK_ORDER → CONSTRUCTION_START` · `SITE_HANDOVER + TECHNICAL_SANCTION → CONSTRUCTION_START` · `CONSTRUCTION_START → EXEC_FOUNDATION → EXEC_SUPERSTRUCTURE → EXEC_FINISHING → COMPLETION → HANDOVER → DLP`.
Node types: APPROVAL = `ADMIN_APPROVAL, TECHNICAL_SANCTION, TENDER_DTP_APPROVAL, COMPLETION`; CLEARANCE = `LOCAL_BODY_CLEARANCE`; MILESTONE = `EXEC_*`; GATE = `CONSTRUCTION_START`; INFORMATION = `DLP`; rest TASK/DOCUMENT. Each node stores its `rule_version_id` (provenance), `assigned_position_type_id`, and `config` (`decision_type`, `sla_days` — labelled *configured, not statutory*, `milestone_code`). Required docs via `workflow_required_documents` (DRAWING, ESTIMATE, LAND_RECORD, BUDGET_PROVISION, …).
Instance freezes `template_version_no` + `context_snapshot` + per-node `source_rule_version_id` (historical reproducibility, D-010).

### 5.4 Rule pack seeded (from docs 22/38/37; nothing invented)
- **Sources:** `SRC-EWM-2020` (Gujarat Engineering Works Manual 2020 Vol I), `SRC-GJ-RNB-AUDIT` (official R&B audit report citing Public Works Manual), `SRC-GJ-CIVIL-SPEC` (civil technical spec), `SRC-GJ-NOTIF` (engineering-work notification), `SRC-WRD-DECISION` (WRD page), `SRC-DEMO-SYNTHETIC`.
- **ENFORCEABLE+VERIFIED:** `RNB-WF-001/002/003`, `RNB-TS-001`, `RNB-TND-001`, `RNB-CNT-001`, `RULE-001/004/005/006/007`. **Conditional:** `RNB-WF-004` (land acquisition), `RNB-BLD-002` (local-body approval), `RNB-CNT-002` (exception → manual). **Advisory only (currency check):** `RNB-BLD-001` (₹25 L architect route), `RNB-TND-002` (₹3 L e-procurement). **Contract-specific:** `RULE-012` DLP, `RULE-010` site records. **WRD-specific** `WRD-AA-001` stored (VERIFIED, scope=WRD) but wired to no R&B/demo project.
- Citations in `rule_citations` exactly as in doc 38 (section numbers only where doc 38 gives them; else "locator to be captured").
- **Synthetic matrix (`DEMO-GOV` only, scope `{"synthetic":true}`):** AA ≤ ₹5 Cr → EE, > ₹5 Cr → SE; TS ≤ ₹15 Cr → EE, > ₹15 Cr → SE; tender DTP approval ≤ ₹5 Cr → EE, > ₹5 Cr → SE; completion certification → EE. UI shows an amber **SYNTHETIC DEMO** badge (derived from `scope.synthetic`), never the green "Verified rule" badge. Global footer: *"Technical prototype — rule registry pending departmental/legal review."*

### 5.5 Authority resolver (`modules/authority`)
Pure decision fn over candidate rows; repo SQL = doc 43 algorithm **plus** rule_version executability join + routing:
1. candidates = `authority_rules` ACTIVE ∧ scope match ∧ cost band ∧ dates ∧ **rule_version executable**; 0 ⇒ `NO_RULE`→`MANUAL_REVIEW`.
2. highest `specificity`; ties on same specificity+priority ⇒ `AMBIGUOUS`.
3. office by `routing_scope` (`OWNING_OFFICE` = project's office; `PROJECT_JURISDICTION` = office whose `office_jurisdictions` cover the project jurisdiction, walking up parents).
4. holder via `v_current_position_holders` (PRIMARY before ACTING/ADDITIONAL_CHARGE); none ⇒ `INACTIVE_POSITION`→`MANUAL_REVIEW`.
5. persist `authority_resolutions` (+ full snapshot). **Never falls back to designation-name guessing.**
Manual-review path (P1): admin with `authority.manual_assign` picks a position + reason ⇒ resolution row `MANUAL_REVIEW` with human assignment in snapshot, audited.

### 5.6 Approval + node state machine
`approval_cases.status`: `PENDING`(ready) —SUBMIT→ `IN_REVIEW` —APPROVE→ `APPROVED` · —RETURN/REQUEST_INFORMATION→ `RETURNED` (resubmit ⇒ `IN_REVIEW`) · —REJECT→ `REJECTED`. `approval_decisions` append-only (one row per action, actor + actor_position + reason). Reason mandatory for RETURN/REJECT.
Node: `INACTIVE`(waiting preds) → `ELIGIBLE`(ready; task/approval_case created) → `ACTIVE`(submitted) → `COMPLETED`; also `BLOCKED` (open BLOCKS issue), `NOT_APPLICABLE`/`SKIPPED`. Execution: `PENDING/IN_PROGRESS/WAITING/COMPLETED/RETURNED/REJECTED`.
**Decide guard order** (doc 07): authenticated → has `approval.decide` → **actor currently holds the resolved position** (else `403 INSUFFICIENT_SCOPE`) → case `IN_REVIEW` → row lock `SELECT … FOR UPDATE` (double-click ⇒ `409 STATE_CONFLICT`) → predecessors complete → required docs present & none REJECTED → apply → then, **same transaction**: `approval_decisions` + `workflow_transitions` + `audit_logs` + `domain_events` (+ `sanctions` row for AA/TS) + `recompute(project)`.
`recompute`: for each INACTIVE node whose gating predecessors are all COMPLETED/N-A ⇒ ELIGIBLE (spawn `tasks` assigned to position; APPROVAL nodes also spawn `approval_cases` + resolve authority); auto-complete GATE/INFORMATION nodes; sync MILESTONE nodes from `milestones`; update `projects.lifecycle_stage`/`operational_status` with optimistic `version_no`.

### 5.7 Blocker analyzer
Frontier node = incomplete, not N/A/SKIPPED, has ≥1 gating downstream, all gating predecessors COMPLETED. Downstream via recursive CTE (depth ≤ 50) over `ACTIVE` `BLOCKING/REQUIRES_COMPLETION` deps. Rank: open `BLOCKS` issue → SLA overdue → downstream count → age. Output per blocker: node, reason, age vs configured SLA, downstream nodes, owner position + current holder, linked issues, rule provenance. Copy per doc UI-copy: *"Current root blocker candidate: … preventing N downstream steps"* — never blame a person; only call it a "mandatory gate" if a verified rule backs it.

## 6. API surface (`/api/v1`, envelope `{data, meta:{requestId}}`, errors `{error:{code,message,requestId,fieldErrors?,sourceRuleId?}}`)
Codes: `UNAUTHENTICATED 401 · INSUFFICIENT_SCOPE 403 · VALIDATION_ERROR 400 · NOT_FOUND 404 · STATE_CONFLICT 409 · RULE_NOT_VERIFIED 422 · AUTHORITY_NOT_RESOLVED 422`.

| Area | Endpoints (P0 unless tagged) |
|---|---|
| Auth | `POST /auth/login` · `GET /auth/me` (roles, permissions, current positions/offices) |
| Org | `GET /offices` `/positions` `/users` `/org/tree` |
| Rules | `GET /rules` `/rules/:id` `/rules/:id/provenance` · `POST /admin/rules/:id/verify` (P1, writes `rule_activation_log`) |
| Projects | `GET/POST /projects` · `GET/PATCH /projects/:id` · `POST /projects/:id/submit` (evaluate rules + generate workflow) · `GET /projects/:id/{workflow,graph,blockers,timeline}` |
| Approvals | `GET /approvals?status=` · `GET /approvals/:id` · `POST /approvals/:id/{submit,approve,return,reject,request-info}` · `POST /approvals/:id/manual-assign` (P1) |
| Tasks | `GET /tasks/mine` · `POST /tasks/:id/complete` |
| Construction | `GET/POST /projects/:id/milestones` · `POST /milestones/:id/progress` (reported≠verified) |
| Inspections | `POST/GET /projects/:id/inspections` · `POST /inspections/:id/{start,submit}` (PASS updates verified progress; FAIL raises issue/rectification task) |
| Issues | `GET/POST /projects/:id/issues` · `POST /issues/:id/resolve` (link to nodes with `BLOCKS/AFFECTS/INFORMS`) |
| Documents | `POST /projects/:id/documents` (multipart→disk, sha256, versions, evidence link) · `GET /documents/:id/download` · `POST /documents/:id/verify` |
| Dashboards | `GET /dashboard/{summary,attention,approvals,overdue}` |
| Audit / Notif | `GET /audit?project&actor&action&from&to` · `GET /notifications` · `POST /notifications/:id/read` |
| AI | `POST /ai/{explain-blocker,next-actions,why-required,ask}` |
| Public (P1) | `GET /public/projects` `/public/projects/:code` (PUBLIC classification only) |
| Variations (P1) | `GET/POST /projects/:id/variations` · `POST /variations/:id/{submit,decide}` |

Route→permission table lives in `.claude/context/domain-cheatsheet.md`. Scope rule (`ProjectAccessPolicy`): role assignment with `organization_id NULL` ⇒ all; else `project.department_organization_id` match; plus `project_members`; **contractor** ⇒ only projects in `contractor_project_assignments` via `contractor_users`.

## 7. Web plan (Stitch → React)
Tokens: copy the `tailwind.config` block from any `Ui/*/code.html` (identical across screens) + `DESIGN.md`. **Offline-safe**: `@fontsource/inter`, `@fontsource/jetbrains-mono`, `material-symbols` (no Google CDN at demo time). Stack: React Router, TanStack Query, `@xyflow/react` + `@dagrejs/dagre`, date-fns, clsx. Logo = the SVG in `Ui/infraflow_official_emblem_logo/code.html`.

| Route | Source | Notes |
|---|---|---|
| `/login` | new | persona quick-buttons (officer, engineer, EE approver, SE approver, inspector, monitor, contractor, admin) |
| `/` Control Center | `infrastructure_control_center` | 4 KPI cards, root-blocker banner, urgent approvals table, overdue SLA watch, progress, audit feed (no fake hashes, **map cut**) |
| `/projects`, `/projects/new` | new | list w/ status chips; create form → submit |
| `/projects/:id` (tabs) | `project_detail_lifecycle` | Overview · Lifecycle · Approvals · Workflow · Construction · Inspections · Documents · Issues · Audit · Copilot |
| `/projects/:id/workflow` | `workflow_dependency_graph` | React Flow custom node (240×76, 4px status rail), drawer: blocker diagnostic, downstream impact, unblock condition, provenance |
| `/projects/:id/inspections/:iid` | `field_inspections_evidence_vault` | tablet layout, browser geolocation, photo upload, checklist, Pass/Observation/Fail |
| `/approvals`, `/tasks` | new | inbox + decision drawer (reason required for return/reject) |
| `/admin/{org,authority,rules,audit}` | new | tree, matrix w/ SYNTHETIC/UNVERIFIED badges, rule provenance, audit timeline |

Global UI rules: **DEMO DATA** chip on every screen; trust badges exactly per doc 34 (`Verified source · Conditional · Contract-specific · Not verified · Superseded` + amber `SYNTHETIC DEMO`); status never by color alone; sidebar shows only permitted items; empty/error states for *authority unresolved*, *rule unverified*, *AI unavailable*.

## 8. AI Copilot (step 9)
- **Gateway** `AiProvider { complete(ctx, mode): Promise<AiAnswer> }` — `OpenAiProvider` (env `OPENAI_API_KEY`, `OPENAI_MODEL` default `gpt-4o-mini`, JSON-schema structured output, 8 s timeout) and `DeterministicProvider` (templates over the same context). Auto-fallback on missing key/timeout/error; UI labels the source ("AI-generated" vs "Rule-based summary").
- **Context builder** (deterministic, permission-filtered): project facts, blocker analysis, node states, executable rule versions + provenance, missing docs. Nothing else is sent (no cross-project leakage).
- **Response contract** (doc 14): `{answer, mode, facts_used[], rules_used[], sources[], confidence, requires_human_review:true}`.
- **Guardrail validator**: every cited `rules_used` must be in the supplied context (else stripped + flagged); `requires_human_review` forced true; no write path exists from AI to approvals/rules/workflow (AI tables are read-only-advisory by design). Persist `ai_runs`, `ai_citations`, `ai_suggestions`. Rate-limited. UI: grounded-in list, mode chip, disclaimer *"AI suggestions are advisory. Official decisions remain with authorized users."*
- Chips (doc 30): What is blocking this project? · What can proceed in parallel? · Why is this approval required? · What documents are missing? · Summarize latest changes.

## 9. Demo data & 6-minute storyline
Seeded personas (all `@demo.infraflow.local`, password `Demo@12345`, synthetic names): **Officer** (DEMO-OFFICER, district), **Engineer/AE** (division), **EE approver** (division), **SE approver** (district) *[new]*, **Field inspector/JE**, **Monitor**, **Contractor**, **Admin**.
Scenario seeder drives the *real* services with an injected `now` (so audit/transitions/decisions carry backdated timestamps without violating append-only triggers):
- **DEMO-INF-0001** (school, ₹12 Cr, fresh) — used **live**: create → generate → AA routes to **SE** (>₹5 Cr) → SE approves → design/estimate → TS routes to **EE** (≤₹15 Cr) → cascade unlocks.
- **DEMO-INF-0002** (construction, at risk) — foundation done, superstructure reported 65% vs verified 42%, one FAIL inspection, open "utility relocation" issue BLOCKS superstructure → root blocker + downstream impact.
- **DEMO-INF-0003** (pre-construction, blocked) — everything through work order done; **site handover pending 8 days** (SLA 3) → blocks construction start + 6 downstream.
- **DEMO-INF-0004** (real R&B dept, no delegation) — AA shows **AUTHORITY_UNRESOLVED / manual review** (P1).
Live flow: Login officer → create → graph appears with **conditional/unknown** nodes flagged → switch to SE persona → approve AA (see provenance + SYNTHETIC badge) → Control Center → open INF-0003 root blocker → Copilot "Why blocked?" with rule citations → inspector submits geo-tagged inspection on INF-0002 → audit timeline.

## 10. Claude Code project files (step 0 — created right after you approve)
- `CLAUDE.md` (~120 lines): purpose, **non-negotiables** (no ORM; no invented rules/authority/citations; AI advisory-only; position-not-person routing; append-only tables; same-txn audit+outbox; synthetic data only), stack, commands, repo map, conventions, pointers to `@.claude/context/*`.
- `AGENTS.md`: short pointer to `CLAUDE.md` + agent roster (for other tools).
- `.claude/context/domain-cheatsheet.md`: distilled table catalog + enums/CHECK values, state machines, resolver algorithm, template graph, route→permission table, error codes, personas — **replaces re-reading the docs**.
- `.claude/context/design-system.md`: DESIGN.md tokens, component specs, Stitch-screen→route map, "port rules" (§2 item 10).
- `.claude/context/demo-script.md`: §9 storyline + seeded scenario definitions.
- `.claude/agents/`: **db-engineer** (owns `infraflow-gov-project/db/**`, `scripts/db-*`), **api-engineer** (owns `apps/api/**`), **web-engineer** (owns `apps/web/**`, reads Stitch HTML), **rules-guardian** (read-only reviewer: greps for hard-coded thresholds/fake citations/SQL outside repos/AI write paths/unverified rules enforced), **demo-qa** (runs `demo-e2e`, drives the browser, reports).
- `.claude/commands/`: `/db-reset`, `/demo-e2e`, `/rules-audit`, `/slice-status` (reads PLAN.md checkboxes).
- `.claude/settings.json`: allow `npm run *`, `npx vitest*`, `npx tsc*`, `docker compose *`, `docker exec infraflow-db psql*`, read-only git; deny reading `.env`.
- Memory (after exit): project overview, your preference for speed + "just decide", locked decisions.

## 11. Verification (how we know it works)
1. `npm run db:up && npm run db:reset` — migrations 001–023 apply on an **empty** DB; seeds run twice with no error (idempotent).
2. `npm test` — vitest: **domain** (rule DSL incl. INDETERMINATE, blocker analyzer, resolver decision fn incl. `AMBIGUOUS`/boundary ₹5 Cr exactly) + **DB integration** on `infraflow_test` (doc 44 checklist): unenforceable rule rejected by CHECK, append-only triggers, outbox claim+publish works, optimistic-lock conflict, recursive downstream count, authority NO_RULE for R&B.
3. `npm run demo:e2e` — scripted API run of the §9 live flow, asserting node states, resolved approvers (SE then EE), audit + event rows, 409 on double-approve, 403 for wrong-position approver, R&B ⇒ `AUTHORITY_NOT_RESOLVED`.
4. Browser walkthrough per persona (dev server, real clicks — type-checks don't prove UI): every §7 route loads, drawers open, reason-required validation, blocker banner matches API, Copilot shows citations, no console errors.
5. `docker compose up --build` on a clean checkout ⇒ `http://localhost:8088` works with no Internet (fonts/icons bundled, AI falls back).
6. `/rules-audit` (rules-guardian) is clean before every demo rehearsal.

## 12. Risks & cut-lines
| Risk | Mitigation |
|---|---|
| Scope explosion | Steps 0–7 are the demo; 8–11 are ordered by wow-per-hour. Cut order (first to drop): map, public portal, variations, measurements/bills UI, manual-assign UI, WRD scenario. |
| Hidden SQL/doc bugs | §2 list + DB tests in step 1 before any API code. |
| Resolver/blocker subtle bugs | Pure-function unit tests written *with* the code. |
| Demo Wi-Fi / no API key | Bundled fonts/icons; deterministic AI fallback; local Postgres. |
| React Flow layout fiddly | Fallback: dagre-computed absolute layout with SVG connectors (same node component). |
| Windows quirks | npm workspaces (no pnpm), `tsx` for dev, forward-slash paths, ports pre-checked. |
| Real-vs-synthetic confusion | SYNTHETIC/DEMO badges are derived from data (`scope.synthetic`, `is_demo`), not hand-typed. |

## 13. Progress checklist (tick as we go; `/slice-status` reads this)
- [x] 0 Scaffold + context files
- [x] 1 DB truth (023 + seeds + tests) — 19 DB tests green; 8 users, 25 rule versions, 7 synthetic authority rules, 19-node/22-edge template
- [x] 2 API skeleton — auth/org/rules + guards + envelope; 41 tests green; DB reset via cached template (~12s)
- [x] 3 Slice 1a project → workflow — rule DSL (3-valued), planner, generator, rule_evaluations, frozen rule versions
- [x] 4 Slice 1b authority + approvals — resolver (never guesses), approvals, tasks, documents, notifications/outbox; 17-step engine-flow test
- [x] 5 Blockers + control tower — analyzer, dashboards, SLA ticker; 117 tests green
- [~] 6 Web shell + Slice 1 UI — PARTIAL: shell, ui kit, login, dashboard, projects list/create, approvals built (typechecks). MISSING: main.tsx/App.tsx entry + routing, project detail, tasks, admin
- [ ] 7 Workflow graph + provenance  ← **core demo complete** (not started in UI; API ready: /workflow, /blockers, /rules/:id/provenance)
- [~] 8 Construction + evidence + scenarios — API DONE (issues gate the graph, milestones reported≠verified, inspections w/ checklist+GPS+evidence, contract); scenario seeder DONE (`npm run seed:scenarios`); 133 tests. UI for these tabs pending
- [~] 9 AI Copilot — backend DONE & smoke-tested offline (context builder, deterministic+OpenAI providers, guardrails, persistence, /ai/* endpoints; 7 guardrail tests). PENDING: API integration tests, copilot panel UI, OpenAI live check (needs key in .env)
- [ ] 10 Admin/audit/extras
- [ ] 11 Docker + rehearsal
