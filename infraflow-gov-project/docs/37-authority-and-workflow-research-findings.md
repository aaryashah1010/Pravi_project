# 37 — Authority & Workflow Research Findings (2026-09-20)

## Research objective

Establish the strongest currently verifiable Gujarat public-works/R&B workflow rules that InfraFlow may model for the first government-building implementation, while preventing unsupported authority thresholds from becoming executable logic.

## Source status

The Government of Gujarat Narmada, Water Resources, Water Supply and Kalpsar Department officially lists the Gujarat Public Works Manual Volume I — Orders on its Manuals and Guidelines page. The manual download link is currently not retrievable through the automated web path because the endpoint redirects incorrectly. Therefore, the underlying 2020 manual text was cross-checked against a hosted copy of the same Government of Gujarat manual, and where possible against independent official Gujarat government documents that reproduce or cite the PWD procedure.

Official manual-list page:
https://guj-nwrws.gujarat.gov.in/showpage.aspx/pdf/downloads/gr/gr_tank/showpage.aspx?contentid=2403&lang=English

Official Gujarat source page last observed updated: 14 Aug 2026.

## A. Verified workflow rules from the Gujarat Engineering Works Manual 2020

### R&B-WF-001 — Three main initiation stages

Statement:
For initiation of original works, the manual identifies three main stages: provision in budget, administrative approval (A/A), and technical sanction (TS).

The manual states that normally no work should be commenced and no liability incurred until sufficient budget provision exists, administrative approval has been obtained, a properly prepared detailed estimate has been technically sanctioned, and funds have been allotted.

Scope:
R&BD/WRD Engineering Works Manual 2020, general public-works scope.

Evidence:
Gujarat Engineering Works Manual 2020, Volume I (hosted copy of the Government of Gujarat manual), section 3.2.

Implementation status:
VERIFIED-WORKFLOW / source copy currentness check required before legal-production use.

### R&B-WF-002 — Administrative approval definition

Statement:
Administrative Approval is the formal acceptance by the competent authority of the proposal to execute a work at a stated sum for the needs of the administrative department.

Scope:
R&BD/WRD works under the manual.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-WF-003 — Budget check before Administrative Approval

Statement:
Before according Administrative Approval for works other than deposit work, the competent authority is to ensure the work appears in the budget book and requisite minimum budget provision is made.

Implementation:
AA readiness check may include budget-provision evidence.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-WF-004 — No ordinary commencement before Administrative Approval

Statement:
Normally work cannot commence and liability cannot be incurred until Administrative Approval has been obtained, except in the stated inescapable/immediate-action circumstances.

Implementation:
Construction-start gate requires AA unless an explicitly configured emergency exception applies.

Important:
Do not create a generic emergency exception without the governing current rule. The prototype should simply flag the exception path for manual review.

### R&B-BLD-001 — Building architectural route at Rs. 25 lakh threshold

Statement:
For building projects costing Rs. 25 lakh and above, the requisitioning department is instructed to approach the Chief Architect, Government of Gujarat for preparation of architectural drawings based on the decided scope. For projects costing less than Rs. 25 lakh, the Executive Engineer of R&BD may be approached directly.

Scope:
Building projects under the R&BD/WRD 2020 manual.

Currentness:
The 2020 manual states this threshold. A current amendment search has not yet established whether the monetary threshold remains unchanged as of 20 Sep 2026.

Implementation status:
REFERENCE-CANDIDATE / NOT ACTIVE until currency is verified.

### R&B-BLD-002 — Private architect work remains subject to Chief Architect approval

Statement:
The manual allows the administrative department to hire a private architect for building works, but says the architectural work is subject to final approval of the Chief Architect of R&BD.

Implementation status:
REFERENCE-CANDIDATE; activate only after current applicability check for project type.

### R&B-WF-005 — Estimate preparation after AA

Statement:
After receipt of Administrative Approval, detailed estimates are prepared for Technical Sanction. The Executive Engineer is to take up estimate preparation as soon as Administrative Approval is received.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-TS-001 — Technical Sanction definition and purpose

Statement:
Technical Sanction is sanction of a properly detailed estimate by the competent technical authority. The manual describes TS as assurance that the proposal is technically sound, the estimate is accurately prepared, and adequate data and appropriate specifications have been used.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-TS-002 — TS before execution

Statement:
For every proposed work, except petty works/petty repairs covered by their special treatment, a properly detailed estimate must be prepared for Technical Sanction and TS must normally be obtained before execution commences.

Implementation:
Construction start should require TS for applicable works.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-TS-003 — Overall TS

Statement:
The authority competent to sanction the whole project can accord overall technical sanction subject to the requirements described in the manual.

Implementation status:
VERIFIED-CONCEPT; exact authority must be resolved from the applicable delegation matrix.

### R&B-WF-006 — Detailed plans / estimates and building project data

Statement:
For buildings, estimates are to be prepared using the applicable architectural and structural information; for large/multistoried structures the manual stresses finalized architectural/structural drawings because otherwise quantities and correct descriptions cannot be accurately prepared.

Implementation:
A project readiness checklist should be able to require the applicable drawings/design package before TS.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-BLD-003 — Local body approval before award where required

Statement:
The manual states that local body approval, wherever required, should be available before awarding the work and that this is the responsibility of the owner department.

Implementation:
This becomes a CONDITIONAL clearance gate: `LOCAL_BODY_APPROVAL_REQUIRED` is triggered only when the applicable jurisdiction/rule package says it is required.

Implementation status:
VERIFIED-CONDITIONAL REQUIREMENT.

### R&B-WF-007 — Land/service shifting staged approvals for major projects

Statement:
For major projects requiring land acquisition, service shifting, tree cutting, etc. as prerequisites to actual construction, the manual describes a second-stage Administrative Approval for those items; the third-stage Administrative Approval for the main project work is to be obtained after 50% of land-acquisition/service-shifting work is completed under that stage-2 sanction. The manual also describes a two-stage approach for PPP bids in the stated context.

Implementation:
Represent stage dependencies; do not assume this applies to every building project.

Implementation status:
VERIFIED-CONDITIONAL WORKFLOW.

### R&B-WF-008 — Revised Administrative Approval / >10% detailed estimate

Statement:
The manual says the revised Administrative Approval procedure applies where modifications to the originally approved proposal are likely to require a revised estimate, where there are deviations from the original proposal even if savings elsewhere might cover the cost, and where detailed estimates exceed the administratively approved amount by more than 10%.

Implementation:
Change/variation engine should calculate:
`detailed_estimate / approved_AA` and trigger a revised-AA review when the documented condition is satisfied.

Implementation status:
VERIFIED-WORKFLOW.

Important:
This is a manual rule from the 2020 source and must still be checked against later amendments before being treated as a legally current production rule.

### R&B-WF-009 — Scope change cannot be hidden inside excess

Statement:
The manual says excess during construction is intended for additional expenditure within the approved plan/specifications and cannot be used to change the scope of the estimate or plan.

Implementation:
The variation module must distinguish `cost_excess` from `scope_change` and force a change/approval path when scope is changed.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-WF-010 — Accepted tender above A/A

Statement:
Where the accepted tender exceeds the Administrative Approval by more than the prescribed limit, revised A/A should normally be obtained. Where there is delay, permission to proceed with award from the authority competent to accord A/A should be obtained before commencement.

Implementation:
Create a `TENDER_VS_AA` validation and a conditional revised-AA/permission gate.

The phrase “prescribed limit” must be sourced from the current applicable authority/delegation rule rather than invented.

Implementation status:
VERIFIED-CONDITION; threshold unresolved.

### R&B-TND-001 — DTP must be approved by competent tender-accepting authority

Statement:
Before a work is given out on contract, the Executive Engineer must have the Draft Tender Paper/tender documents duly approved by the authority competent to accept the tender. Special conditions require prior approval by the competent authority.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-TND-002 — Pre-consult higher authority when likely beyond current tender power

Statement:
If the tender amount is likely to be beyond the Executive Engineer's power of acceptance, the contract documents should be submitted to the Superintending Engineer before publicly inviting tenders. If likely to exceed the Superintending Engineer's power or to be of a very special nature, the documents should similarly be submitted to the Chief Engineer.

Implementation:
Tender initiation should run an authority-limit precheck.

Important:
The exact acceptance limits are not yet legally verified from Appendix XXIII/current delegation material.

Implementation status:
VERIFIED-WORKFLOW / THRESHOLD OPEN.

### R&B-TND-003 — E-procurement above Rs. 3 lakh in the 2020 manual

Statement:
The 2020 manual states that all works costing above Rs. 3 lakh are to be tendered through E-Procurement.

Implementation status:
REFERENCE-CANDIDATE / CURRENTNESS CHECK REQUIRED.

The state eProcurement platform itself is an existing government integration boundary.

### R&B-TND-004 — Tender invitation/receipt responsibilities by amount in the 2020 manual

Statement:
The 2020 manual specifies, for tenders by estimate amount: up to Rs. 3 lakh — invited/received by Deputy Executive Engineer; more than Rs. 3 lakh up to Rs. 25 lakh — invited/received by Executive Engineer; more than Rs. 25 lakh — invited by Executive Engineer and received/opened by Superintending Engineer, with possible forwarding to Chief Engineer.

Implementation status:
REFERENCE-CANDIDATE / CURRENTNESS CHECK REQUIRED.

### R&B-TND-005 — Lowest-bid / non-lowest committee behavior

Statement:
The 2020 manual says the lowest tender is usually accepted subject to capability/financial/security/execution concerns. Where a tender other than the lowest is proposed, the decision is to be taken by committees at the appropriate levels rather than an individual officer. The manual lists an Executive Engineer + Collector committee at EE level; a committee of the concerned SE plus two other SEs at SE level; and at CE level a committee comprising the Secretary R&B/WRD, Secretary (Expenditure), Finance Department, and the concerned CE.

Implementation status:
REFERENCE-CANDIDATE / CURRENTNESS CHECK REQUIRED.

Important:
This is a procedural rule from the 2020 manual; current government orders/amendments need to be checked before executable use.

### R&B-CNT-001 — Contract completion before acceptance

Statement:
The manual states that no tender should be accepted before contract documents are completed in all respects.

Implementation status:
VERIFIED-WORKFLOW.

### R&B-CNT-002 — Start before signed tender documents is an exceptional case

Statement:
An officer competent to accept a tender may in rare cases ask the contractor to start before tender documents are signed, for recorded reasons, with intimation to Government.

Implementation:
Do not create this as a normal workflow branch. Expose it only as a manually reviewed exception with evidence and audit logging.

Implementation status:
VERIFIED-EXCEPTION / not default.

### R&B-MB-001 — Computerised Measurement Book threshold in 2020 manual

Statement:
The 2020 manual states that computerized measurement books are mandatory for R&B works where the estimated amount put to tender is above Rs. 25 lakh, and for WRD works above Rs. 5 lakh. It also says the department may change the threshold from time to time.

Implementation status:
REFERENCE-CANDIDATE / MUST BE CURRENTLY VERIFIED before automatic enforcement.

### R&B-EXT-001 — Time-extension rule in the WRD decision-process page

Statement:
The official Gujarat Water Resources Department decision-process page says that for scheme works, if extraordinary reasons require an extension, proposals may be processed for up to 50% additional time for works up to Rs. 30 lakh and up to 25% for works above Rs. 30 lakh, with the process routed through the Superintending Engineer to the Chief Engineer in that stated WRD process.

Scope:
Specific WRD decision-process page, not a universal R&B building rule.

Implementation status:
VERIFIED-WRD-SPECIFIC / DO NOT GENERALIZE.

Source:
https://guj-nwrws.gujarat.gov.in/showpage.aspx/mediafiles/pdf/forms/showpage.aspx?contentid=4067&lang=English

## B. Exact authority thresholds still not verified

The 2020 manual explicitly states that R&BD/WRD officer powers for works are in Appendix XXIII of Engineering Works Manual Volume II and that the broader compendium contains delegated administrative, financial and statutory powers.

Therefore:

- Do not hard-code `AA amount -> designation` for R&B using assumptions.
- Do not hard-code `TS amount -> designation` for R&B using assumptions.
- Do not hard-code tender acceptance monetary limits for R&B from general intuition.
- Do not assume district/taluka officers can sanction merely because of location.

The correct resolution model remains:

`project attributes -> applicable department rule package -> authority/delegation rule -> jurisdiction -> position -> current holder`

## C. Fully verified WRD administrative-approval matrix found on official Gujarat page

The official WRD decision-process page publishes the following thresholds for the stated **Water Resources Department “new scheme” administrative approval process**:

- Up to Rs. 30 lakh: Chief Engineer + Additional Secretary level.
- More than Rs. 30 lakh and up to Rs. 1 crore: Secretary, WRD, in consultation with the department's Financial Advisor.
- More than Rs. 1 crore and up to Rs. 5 crore: Additional Chief Secretary, Expenditure/Finance Department.
- More than Rs. 5 crore: Additional Chief Secretary, Finance Department.

Source:
https://guj-nwrws.gujarat.gov.in/showpage.aspx/mediafiles/pdf/forms/showpage.aspx?contentid=4067&lang=English

Status:
VERIFIED-WRD-SPECIFIC. This MUST NOT be copied into the generic R&B building authority table.

## D. Design decision resulting from research

InfraFlow will support multiple department rule packages.

Initial packages:

1. `rnb-works-2020-baseline` — R&B/WRD Engineering Works Manual workflow facts; only individually verified rules are active.
2. `wrd-new-scheme-decision-process` — WRD-specific decision-process rules, including the published AA thresholds above.
3. `rnb-building-current` — placeholder package for the current R&B building delegation/clearance rules; no monetary authority rules activated until primary current source is obtained.

This lets the software remain honest while still allowing a complete working prototype.
