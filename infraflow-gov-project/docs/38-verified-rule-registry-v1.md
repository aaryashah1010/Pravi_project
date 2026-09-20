# 38 — Verified Rule Registry v1

## Purpose

This file is the human-readable rule registry for the first implementation. A rule can be promoted to deterministic enforcement only when its source, scope and currentness are sufficient.

## Rule status

- `ACTIVE_VERIFIED`: safe for deterministic prototype enforcement within stated scope.
- `VERIFIED_NEEDS_CURRENCY_CHECK`: source/rule is clear but the currentness of the monetary threshold or amendment status is not fully established.
- `CONDITIONAL_VERIFIED`: rule is verified but requires explicit project facts.
- `WRD_SPECIFIC`: active only for WRD process scope.
- `REFERENCE_ONLY`: not executable.
- `UNVERIFIED`: not executable.

## Active or near-active rules

### RNB-WF-001
Status: ACTIVE_VERIFIED

Before normal work commencement, the project should have the applicable budget provision, Administrative Approval, properly prepared detailed estimate with Technical Sanction, and fund allotment/availability as required by the manual's initiation rule.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.2, Government of Gujarat.

### RNB-WF-002
Status: ACTIVE_VERIFIED

Administrative Approval is the competent authority's formal acceptance of the proposal to execute the specified work at the stated sum.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.2.2.

### RNB-TS-001
Status: ACTIVE_VERIFIED

A properly detailed estimate requires Technical Sanction by the competent technical authority before normal execution.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.2.3.

### RNB-WF-003
Status: ACTIVE_VERIFIED

Detailed estimate preparation follows Administrative Approval; for building projects the estimate/design package must contain the technical information necessary for a sound estimate.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Sections 3.2.2–3.4.

### RNB-BLD-001
Status: VERIFIED_NEEDS_CURRENCY_CHECK

For building projects at or above Rs. 25 lakh, the 2020 manual directs the requisitioning department to approach the Chief Architect for architectural drawings; below Rs. 25 lakh, the Executive Engineer of R&BD may be approached directly.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.2.2(a).

Do not activate as a 2026 monetary trigger until an amendment/currency check is documented.

### RNB-BLD-002
Status: CONDITIONAL_VERIFIED

Where local-body approval is required, it should be available before award and the owner department is responsible for obtaining it.

Source:
Gujarat Engineering Works Manual 2020, Volume I, building requirements section.

Applicability resolver required:
planning jurisdiction / project type / applicable regulation.

### RNB-WF-004
Status: ACTIVE_VERIFIED

Where major works require land acquisition/service shifting/tree cutting as construction prerequisites, the manual describes staged administrative approvals and a dependency on progress of those prerequisite activities.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.2.2(b).

Applicability must be explicit; do not apply to every project.

### RNB-WF-005
Status: ACTIVE_VERIFIED

Revised Administrative Approval is to be considered where approved proposal modifications/deviations trigger a revised estimate and where a detailed estimate exceeds the administratively approved amount by more than 10%, subject to the manual's detailed conditions.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.2.2(d).

### RNB-WF-006
Status: ACTIVE_VERIFIED

The amount of excess may not be used as a hidden mechanism to change the approved scope/plan.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.2.2(d).

### RNB-TND-001
Status: ACTIVE_VERIFIED

Draft Tender Paper/tender documents require approval by the authority competent to accept the tender before the work is given out on contract.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.5.

### RNB-TND-002
Status: VERIFIED_NEEDS_CURRENCY_CHECK

The 2020 manual states that works above Rs. 3 lakh are to use e-procurement.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.5.4.

Do not treat the Rs. 3 lakh threshold as a 2026 active statutory/procurement threshold until checked against current procurement instructions.

### RNB-CNT-001
Status: ACTIVE_VERIFIED

No tender should be accepted before the contract documents are completed in all respects, subject to the manual's exceptional start provisions.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.5.23.

### RNB-CNT-002
Status: CONDITIONAL_VERIFIED

Starting before signed tender documents is an exceptional, recorded-reason case that must be intimated to Government.

Source:
Gujarat Engineering Works Manual 2020, Volume I, Section 3.5.

### WRD-AA-001
Status: WRD_SPECIFIC

For the WRD “new scheme” administrative approval process on the official decision-process page:

- Up to Rs. 30 lakh: Chief Engineer + Additional Secretary level.
- > Rs. 30 lakh to Rs. 1 crore: Secretary, WRD, with Financial Advisor consultation.
- > Rs. 1 crore to Rs. 5 crore: Additional Chief Secretary (Expenditure/Finance).
- > Rs. 5 crore: Additional Chief Secretary, Finance Department.

Source:
Official Gujarat Narmada/Water Resources decision-process page.
https://guj-nwrws.gujarat.gov.in/showpage.aspx/mediafiles/pdf/forms/showpage.aspx?contentid=4067&lang=English

Important:
This is not an R&B building rule.

## Rules intentionally NOT active

- Exact R&B Administrative Approval monetary competence matrix.
- Exact R&B Technical Sanction monetary competence matrix.
- Exact current R&B tender acceptance monetary powers.
- Exact current fire clearance applicability thresholds.
- Exact current local planning-authority routing by every Gujarat jurisdiction.
- Exact current variation/excess monetary powers by designation.
- Exact current time-extension delegation for R&B.
- Any rule inferred from title/designation alone.

## Promotion rule

A rule moves to `ACTIVE_VERIFIED` only when:

1. the normative source is identified;
2. applicability/scope is known;
3. the rule is not superseded;
4. monetary thresholds are confirmed against the current delegation/order where applicable;
5. source location (clause/page/section) is recorded;
6. a reviewer has approved the normalization.
