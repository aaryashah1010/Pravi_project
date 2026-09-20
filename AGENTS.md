# AGENTS.md

This repo's canonical agent/contributor guide is **`CLAUDE.md`** — read it first (non-negotiables, stack, commands, conventions). Build plan and progress: `PLAN.md`. Distilled domain knowledge: `.claude/context/`.

## Roster (defined in `.claude/agents/`)
| Agent | Owns | Never touches |
|---|---|---|
| `db-engineer` | `infraflow-gov-project/db/**`, `scripts/db-*`, DB tests | `apps/**` |
| `api-engineer` | `apps/api/**`, `packages/shared/**` | `apps/web/**`, migrations 001–022 |
| `web-engineer` | `apps/web/**` | `apps/api/**` (uses `packages/shared` contract) |
| `rules-guardian` | read-only compliance audit | everything (report only) |
| `demo-qa` | runs `npm run demo:e2e`, drives the browser, reports | source edits |

Hard rules for every agent: no ORM; no invented rules/authority/citations; AI advisory-only; position-not-person routing; audit+outbox in the same transaction; synthetic data only.
