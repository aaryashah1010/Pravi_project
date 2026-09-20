# Demo script & seeded scenarios (6 minutes)

All accounts `<prefix>@demo.infraflow.local`, password `Demo@12345`. Login page has one-click persona buttons.

## Seeded projects (created by `scripts/seed-scenarios.ts` through the REAL services with backdated `ctx.now`)
| Code | State | What it demonstrates |
|---|---|---|
| `DEMO-INF-0001` | Fresh: ₹12 Cr school, Ahmedabad / Taluka-01, created but **not yet submitted** | Live flow: submit → graph generation → AA routes to **SE** (>₹5 Cr) → TS routes to **EE** (≤₹15 Cr) |
| `DEMO-INF-0002` | Construction, at risk | Foundation done; superstructure reported 65% vs verified 42%; one FAIL inspection; open "utility relocation" issue BLOCKS `EXEC_SUPERSTRUCTURE`; root blocker + downstream impact |
| `DEMO-INF-0003` | Pre-construction, blocked | AA/TS/tender/contract/work order done; **`SITE_HANDOVER` pending 8 days (configured SLA 3d)** blocks `CONSTRUCTION_START` + 6 downstream |
| `DEMO-INF-0004` | Real R&B dept `GJ-RNB`, no delegation | AA ⇒ `AUTHORITY_UNRESOLVED` / manual review — "engine refuses to guess" (P1) |

## Live storyline
1. **Officer** logs in → Control Center shows portfolio + INF-0003 root-blocker banner.
2. Officer creates/opens `DEMO-INF-0001`, enters facts (leave `local_body_approval_required` unset) → **Submit** → 19-node graph appears; `LOCAL_BODY_CLEARANCE` shows *Conditional — pending verification*; advisory nodes show *currency check required*.
3. Click `ADMIN_APPROVAL` → provenance panel: rule `RNB-WF-002` (Verified source, EWM-2020) and authority rule with amber **SYNTHETIC DEMO** badge; resolved to SE position.
4. Switch to **SE** → Approvals inbox → open case → approve (try Return without reason ⇒ validation). Cascade: `DESIGN_ESTIMATE` becomes ELIGIBLE, task appears for engineer; notification bell increments for engineer.
5. Show guardrails: wrong-position user gets 403; double-click approve gets 409.
6. **Monitor** → INF-0003 → workflow graph → click red `SITE_HANDOVER` → blocker diagnostic (age 8d vs SLA 3d, 7 downstream, owner position, provenance RULE-007) → Copilot chip "Why is this blocked?" → answer with rule citations + advisory disclaimer (works offline via deterministic provider).
7. **Inspector** → INF-0002 → open pending inspection on tablet layout → GPS + photo + checklist → submit FAIL ⇒ issue/rectification task raised, audit row.
8. Audit timeline (append-only) + Admin → Authority Matrix showing SYNTHETIC vs *no delegation configured* for real R&B.

## Talking points
Position-not-person routing (transfer test: reassign SE user ⇒ task follows the position) · verified-rules-only enforcement · historical reproducibility (workflow stores rule versions) · AI cannot approve · everything append-only audited.
