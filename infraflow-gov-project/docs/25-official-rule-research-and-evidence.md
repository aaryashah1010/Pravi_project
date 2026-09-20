# 25 — Official Rule Research & Evidence Policy

## Purpose

This document defines how InfraFlow converts government documents into executable workflow rules without inventing or generalizing unsupported procedures.

## Current target scope

Initial implementation: one configurable Gujarat government/public-works building workflow. The prototype is not a complete codification of every Gujarat department, every infrastructure type, or every statutory approval.

## Non-negotiable principle

An automated rule may affect project state, routing, blocking, escalation, or approval readiness only when its applicability and authority are supported by an authoritative source.

## Source hierarchy

### Tier 1 — Primary authoritative instruments

- Acts and rules
- Government notifications
- Government resolutions/orders/circulars
- Departmental manuals/rule books
- Delegation/compendium of powers
- Statutory regulations issued by the competent authority

### Tier 2 — Official departmental material

- Official department process/RTI pages
- Official manuals hosted by a government domain
- Official forms/checklists
- Official scheme/procedure documents

### Tier 3 — Official project/tender/contract documents

Useful for project-specific contractual requirements. Do not generalize a tender-specific condition into a universal rule unless an authoritative broader instrument supports it.

### Tier 4 — Official audit/inspection reports

Useful evidence of how rules were interpreted or applied in a real case. An audit observation is not automatically a universal rule.

### Tier 5 — Existing government systems/RFPs

Useful for domain discovery, data fields, workflow concepts, and integration boundaries. Existing system behavior is not itself a legal rule.

### Tier 6 — Secondary sources

Use only for discovery. Do not use secondary sources as the basis for deterministic legal/administrative enforcement when a primary source is required.

## Current official source set

### S1 — Gujarat Public Works Manual listing

Official Government of Gujarat Narmada, Water Resources, Water Supply and Kalpsar Department page lists `Gujarat public works manual volume 1- orders` under Manuals and Guideline.

Official page:
https://guj-nwrws.gujarat.gov.in/showpage.aspx/pdf/downloads/gr/gr_tank/showpage.aspx?contentid=2403&lang=English

Research status: **SOURCE_CONFIRMED / DOCUMENT_HOST_CONFIRMATION**. The page confirms the government-hosted manual exists. The manual download endpoint currently redirects incorrectly in automated retrieval, so exact clause extraction from that endpoint remains an open research item.

### S2 — Gujarat R&B audit report quoting Public Works Manual requirements

Official Roads & Buildings Water Management System document, Audit Para 3.7, records that the Gujarat Public Works Manual requires works to commence only after detailed structural designs are approved and that work should not commence on land that has not been duly handed over by the responsible civil officer.

Official document:
https://rnbwms.guj.nic.in/master/pdf_handler.php?f=MjUwNw%3D%3D

Research status: **VERIFIED FOR THE STATED MANUAL-QUOTED REQUIREMENTS**.

Important: the audit report is evidence that the cited manual requirements exist and were applied in that audited case. The application should still store the manual as the normative source when the exact manual clause is obtained.

### S3 — Gujarat decision-process material

Official Gujarat Narmada/Water Resources page describes decision processes and identifies the Gujarat State Construction Rule Compendium and the Compendium of Administrative/Financial/Statutory powers of officers of R&B and Irrigation departments as guidance sources. It separately lists administrative approval of new schemes, overall technical approval of plans/estimates, draft tender document approval, pre-qualification tender approval, price bid approval, extra items, and extension of tender time.

Official page:
https://guj-nwrws.gujarat.gov.in/showpage.aspx/mediafiles/pdf/forms/showpage.aspx?contentid=4067&lang=English

Research status: **VERIFIED AS OFFICIAL PROCESS-MAPPING EVIDENCE; EXACT R&B BUILDING THRESHOLDS NOT YET EXTRACTED**.

### S4 — Gujarat civil technical specification

Official Gujarat Costing/engineering technical specification identifies contractor site records including contract documents/drawings, bill format, site order book, material testing/quality inspection reports, computerized measurement books, progress bar chart, sample approval register, hindrance register, work diary, deviation/variation order registers, material registers, request for work inspection, joint measurement book, daily labour report, and quality checklist.

Official PDF:
https://gujcost.gujarat.gov.in/ViewFile?fileName=GBDx7HzIiKHUtUjgUSLEHASH_HASHWyH4Ym3HRBHASH_HASHoIZ0CAJMLVwlWrsgEpNL5yg1BskHASH_HASHMRTQ1c4SycobOYcIENrAU3JoOjudydWoILeN7kRtgLvuLh9eW4pYLKg2dLQQhpbN4aZtOTHASH__HASHRcpO20tXwGcUi0a94iQ%3D%3D

Research status: **VERIFIED FOR THE DOCUMENTED RECORD TYPES AND TECHNICAL/QUALITY REQUIREMENTS**.

### S5 — Gujarat IWDMS

Official GIL material describes IWDMS as a government workflow/document management platform with organization/workflow models, access controls, knowledge management, dashboards, MIS, policy-based processing, audit trails, task prioritization, reminders, and interdepartmental interfaces.

Official page:
https://gil.gujarat.gov.in/iwdms

Research status: **VERIFIED AS EXISTING-GOVERNMENT-SYSTEM CONTEXT, NOT AS CONSTRUCTION LAW**.

### S6 — Gujarat eProcurement

Official GIL material describes the state eProcurement platform used by Government of Gujarat departments and organizations for electronic tendering, including tender publication/submission and multi-stage evaluation capabilities.

Official page:
https://gil.gujarat.gov.in/eprocurement

Research status: **VERIFIED AS EXISTING-SYSTEM / INTEGRATION CONTEXT**.

## Rule status vocabulary

- `VERIFIED`: authoritative source and applicability are documented.
- `CONDITIONAL`: requirement is authoritative but depends on explicit project facts.
- `CONTRACT_SPECIFIC`: comes from a particular tender/contract.
- `REFERENCE_ONLY`: useful context; not executable.
- `UNVERIFIED`: insufficient evidence; cannot block/route automatically.
- `SUPERSEDED`: historical version retained for audit but not active.
- `CONFLICT_REQUIRES_REVIEW`: active sources conflict and the system must not choose silently.

## Evidence requirements for executable rules

Every executable rule needs:

1. Rule code.
2. Human-readable statement.
3. Scope.
4. Preconditions/conditions.
5. Result/action.
6. Source document ID.
7. Clause/section/page where available.
8. Issuing authority.
9. Publication date if available.
10. Effective-from date.
11. Effective-to/superseded date when available.
12. Verification status.
13. Reviewer and review date for the prototype's governance process.

## What we must never do

- Invent a financial threshold.
- Guess a competent authority from job-title intuition.
- Assume every government building needs the same NOCs.
- Treat one department's procedure as a state-wide universal rule.
- Treat a tender-specific requirement as a permanent statutory rule.
- Allow an LLM to manufacture a legal rule.
- Automatically reject/approve an application solely from an AI output.

## Current verified rule candidates

### RULE-CAND-001 — approved detailed design before work commencement

Status: `VERIFIED_FOR_PROTOTYPE_BASELINE`

Statement: Official Gujarat audit material quoting the Gujarat Public Works Manual states that works shall be commenced only after detailed structural designs are approved.

Enforcement: A configured `CONSTRUCTION_START` gate may require approved detailed design evidence when the project is within this rule's scope.

Source: S2.

### RULE-CAND-002 — land duly handed over before work commencement

Status: `VERIFIED_FOR_PROTOTYPE_BASELINE`

Statement: The same official Gujarat audit material states that work should not commence on land that has not been duly made over by the responsible civil officer.

Enforcement: A configured `SITE_HANDOVER` / `LAND_POSSESSION` gate may block construction start for applicable works.

Source: S2.

### RULE-CAND-003 — construction/site record classes

Status: `VERIFIED_FOR_SPECIFICATION_SCOPE`

Statement: The official Gujarat civil technical specification documents the site records listed in S4.

Enforcement: Create configurable evidence/document checklists based on the applicable technical specification package.

Source: S4.

## Research gap register

| Gap | Importance | Status |
|---|---:|---|
| Exact current R&B delegation thresholds for AA/TS | Critical | Open |
| Current Appendix/Compendium authority mapping | Critical | Open |
| Exact building permission triggers for the selected jurisdiction | Critical | Open |
| Fire-related applicability thresholds | Critical | Open |
| Current procurement/contract rule package for selected project type | High | Open |
| Current variation/revised-sanction thresholds | Critical | Open |
| Completion/DLP rules applicable to selected contract type | High | Open |

Until these are verified, the corresponding engine behavior must be configurable/non-enforcing.
