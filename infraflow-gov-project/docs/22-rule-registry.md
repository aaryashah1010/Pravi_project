# 22 — Rule Registry

## Purpose

This registry is the single source of truth for executable government-process rules.

## Required fields

| Field | Purpose |
|---|---|
| Rule ID | Stable identifier |
| Version | Rule version |
| Rule Type | Workflow/authority/clearance/document/etc. |
| Scope | Department/project type/jurisdiction |
| Conditions | Applicability conditions |
| Action | Workflow action generated |
| Source ID | Linked official source |
| Citation | Clause/page/section |
| Effective From | Start date |
| Effective To | End date if superseded |
| Status | Verified/conditional/unverified/etc. |
| Verification Note | Why it is accepted |
| Reviewer | Person/authority who verified |

## Initial source-backed rule cards

### RULE-001 — Proposal with cost estimate

Status: VERIFIED at the domain-backbone level.

Claim: Engineering work process includes preparation of proposals with cost estimates.

Primary support: Gujarat government official notification reproducing engineering-work execution provisions; the provision states that proposals with cost estimate are prepared for construction/repair works.

Do not infer a universal approval authority from this rule.

### RULE-002 — Administrative approval and technical sanction where required

Status: VERIFIED at the domain-backbone level.

Claim: The engineering-work execution provision requires obtaining administrative approval and technical sanction wherever required before undertaking the work.

Source: Gujarat government official notification / engineering works provision.

Do not invent the authority or financial threshold from this statement alone.

### RULE-003 — Tendering according to existing rules/manuals/norms

Status: VERIFIED at the domain-backbone level.

Claim: Tender/offer/quotation processes are to follow existing government rules, manuals or norms as applicable.

Source: Gujarat government official notification.

### RULE-004 — Periodic monitoring and inspection

Status: VERIFIED at domain-backbone level.

Claim: Engineering works are to be monitored and inspected periodically.

Source: Gujarat government official notification.

### RULE-005 — Work records must be maintained

Status: VERIFIED at domain-backbone level.

Claim: Engineering works require maintenance of records.

Source: Gujarat government official notification.

### RULE-006 — Detailed design approval before commencement

Status: VERIFIED for the cited Gujarat Public Works Manual application.

Claim: Official Gujarat audit material cites the Gujarat Public Works Manual as requiring works to commence only after detailed design of structures is approved.

Source: Gujarat R&B audit report (official government site).

### RULE-007 — Land must be duly made over before commencement

Status: VERIFIED for the cited Gujarat Public Works Manual application.

Claim: Official Gujarat audit material cites the Gujarat Public Works Manual as providing that work should not commence on land that has not been duly made over by the responsible civil officer.

Source: Gujarat R&B audit report (official government site).

### RULE-008 — AA and TS are distinct recorded approvals in cited R&B project

Status: VERIFIED as evidence of separate AA and TS in the cited case; not by itself a universal authority/threshold rule.

Source: Gujarat R&B audit report.

### RULE-009 — Work order after tender acceptance in cited case

Status: REFERENCE / case evidence.

The cited audit report records tender acceptance followed by issue of a work order. The system may model the relationship as part of the project lifecycle, but universal legal sequencing must be confirmed against the applicable manual/rules for the selected department.

### RULE-010 — Site documentation categories

Status: VERIFIED as a Gujarat civil technical-specification requirement for the referenced project/specification.

The specification lists Site Order Book, quality inspection/material testing records, computerized measurement books, progress bar chart, Hindrance Register, Work Diary, deviation/variation registers, inspection request, joint measurement book, daily labour report and quality checklist among site documents.

These are not automatically universal across every project.

### RULE-011 — Existing Gujarat eProcurement integration point

Status: VERIFIED infrastructure fact, not a workflow rule.

GIL states that nProcure supports e-tendering/e-auction and hosts government department tenders.

### RULE-012 — DLP is contract-specific

Status: VERIFIED as a data-model policy.

A Gujarat contract can specify a DLP period and rectification obligations. The exact duration must be read from the relevant contract; do not use one universal DLP value.

## Rules that remain intentionally unfilled

The following are **not executable yet** until the applicable official source is collected and verified for the chosen department/scenario:

- exact AA financial thresholds;
- exact TS financial thresholds;
- exact district/taluka/circle/division authority thresholds;
- exact building-plan authority routing for every jurisdiction;
- exact fire clearance trigger thresholds;
- exact environmental clearance triggers;
- exact financial approval limits;
- exact payment approval limits;
- exact tender evaluation method for every procurement type;
- exact performance-security percentage;
- exact variation threshold requiring revised approval;
- exact DLP duration by project class;
- exact escalation SLA unless an official citizen-service/departmental SLA applies.

## Rule ingestion policy

No production rule enters `rule_version` with status `VERIFIED` until:

1. source is authoritative;
2. scope is clear;
3. effective date is known or explicitly unknown;
4. citation is captured;
5. rule logic is reviewed;
6. contradictory active sources are resolved;
7. test cases pass.
