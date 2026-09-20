# Design system & Stitch port rules

Source of truth: `Ui/institutional_operational_precision/DESIGN.md` + tokens in any `Ui/*/code.html` `tailwind.config` block (identical across screens; copy it verbatim into `apps/web/tailwind.config.ts`). Screenshots: `Ui/*/screen.png`.

## Tokens (short)
Font: **Inter** (UI) + **JetBrains Mono** (codes, rule IDs, coords, money in grids); `tnum` on numerics. Canvas `#f8f9ff` (`background`), cards white with `outline-variant` border + `shadow-sm`. Navy `primary-container #1e3a8a` = primary buttons/nav-active; `secondary #0051d5` = interactive; semantic: emerald (verified/complete), amber (pending/at-risk), rose (blocker/rejected), slate (draft/conditional). Radius: cards `rounded-lg`(tailwind extended = 0.25rem in Stitch config → use as-is), badges 4px, **no pill buttons**. Grid 8px; sidebar 256px; top bar 64px; optional right inspector 384px. Table rows 36–44px.
Badge anatomy: 6px dot + uppercase 11px label + optional mono rule code.
Workflow node: 240×76 card, 4px left status rail (emerald/amber/rose/slate), 2px solid connector when complete, 2px dashed when pending.

## Offline-safe assets
`@fontsource/inter`, `@fontsource/jetbrains-mono`, `material-symbols` (Material Symbols Outlined; keep Stitch icon names like `account_tree`, `hub`, `verified`). No Google CDN, no Tailwind CDN. Logo = SVG in `Ui/infraflow_official_emblem_logo/code.html` (40×40 navy rounded square, white "M", cyan dot).

## Stitch screen → route → data
| Screen (dir) | Route | Data sources |
|---|---|---|
| `infrastructure_control_center` | `/` | `/dashboard/summary`, `/dashboard/attention`, `/approvals`, `/dashboard/overdue`, `/audit?limit=5` |
| `project_detail_lifecycle` | `/projects/:id` | project, workflow, blockers, approvals, milestones, evidence, audit |
| `workflow_dependency_graph` | `/projects/:id/workflow` | `/projects/:id/graph`, `/projects/:id/blockers`, rule provenance |
| `field_inspections_evidence_vault` | `/projects/:id/inspections/:iid` | inspection, template checklist, documents |
| `infraflow_official_emblem_logo` | `<Logo/>` | static SVG |
Not in Stitch (hand-build in same style): login, project list/create, approvals inbox+drawer, tasks, documents, issues, audit, copilot, admin (org tree, authority matrix, rule registry).

## PORT RULES (do not violate)
1. **Never copy fabricated strings** from the HTML: "Rule 18-B", "Ch. IV §12.3", "Form 14-A", "Rule R-001 (Land Code)", "SHA-256 validated", "Sig Hash", "L3 Authority", node IDs like `GID-AHM-02`, "Er. Rajesh Patel", "Patel & Sons", "Gujarat IDS". Structure/layout yes, content no.
2. All rule/provenance/citation text renders from API data. If `rule_citations` empty ⇒ "Citation locator to be captured". Unknown rule ⇒ `Not verified` badge + "Manual verification required".
3. Synthetic matrix rows/badges show amber **SYNTHETIC DEMO**; never the green "Verified source" badge.
4. `DEMO DATA` chip in the top bar on every screen; footer: "Technical prototype — rule registry pending departmental/legal review."
5. Status never by color alone (dot + label + icon). Sidebar shows only permitted items. Do not blame individuals in blocker copy: "Current root blocker candidate: X. It is preventing N downstream steps from becoming ready."
6. Authority unresolved copy: "The system could not resolve a verified competent authority for this project state. No automatic assignment was made."
7. AI disclaimer (always visible in copilot): "AI suggestions are advisory. Official decisions remain with authorized users."
8. Cut from Stitch: GIS map panel, "cryptographic" hash claims, export-PDF button (unless implemented).
