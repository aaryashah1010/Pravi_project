# 03 — Project Lifecycle

## Canonical lifecycle for the prototype

The following is the canonical **domain lifecycle** for a government/public-works building scenario. It is not a claim that every department or project uses every step or the exact same order.

```text
Need / Project Identification
        ↓
Project Proposal
        ↓
Site / Land Readiness
        ↓
Budget / Funding
        ↓
Administrative Approval (where applicable)
        ↓
Detailed Design + Detailed Estimate
        ↓
Technical Sanction (where applicable)
        ↓
Applicable Clearances / Permissions
        ↓
Tender Preparation
        ↓
Tender / Procurement
        ↓
Bid Evaluation
        ↓
Award / Contract
        ↓
Work Order
        ↓
Site Handover / Commencement Preconditions
        ↓
Construction Execution
        ↓
Inspection / Measurement / Quality
        ↓
Milestone / Bill / Payment Processing
        ↓
Variation / Revised Approval Loop if required
        ↓
Completion
        ↓
Final Inspection / Completion Records
        ↓
Handover
        ↓
DLP / Maintenance where applicable
        ↓
Project Closure
```

## Source-backed backbone

Official Gujarat material identifies the following as part of the engineering-work lifecycle:

- prepare proposal with cost estimate;
- obtain administrative approval and technical sanction wherever required;
- invite/finalize tenders according to applicable government rules/manuals/norms;
- monitor works and inspect progress periodically;
- maintain work records.

An official Gujarat audit report cites the Gujarat Public Works Manual as requiring detailed designs to be approved before works commence and land to be duly made over before work starts. The same report documents a project where AA and TS were separately accorded, a tender was accepted, and a work order followed.

## Important conditionality

The prototype must not assume:

- every project needs every NOC;
- every project follows the same authority;
- every department uses the same internal office structure;
- every project has the same DLP;
- every deviation requires the same level of revised sanction;
- every tender follows an identical evaluation method.

Those details are represented as configurable rule packages with source provenance.

## State transitions

The project lifecycle should be implemented as a state machine plus a dependency graph.

Possible project states:

- DRAFT
- PROPOSED
- UNDER_REVIEW
- APPROVAL_PENDING
- PROCUREMENT_READY
- IN_PROCUREMENT
- CONTRACTED
- READY_TO_START
- UNDER_CONSTRUCTION
- AT_RISK
- BLOCKED
- COMPLETION_PENDING
- COMPLETED
- HANDED_OVER
- DLP_ACTIVE
- CLOSED

A project can be `AT_RISK` or `BLOCKED` while still being in its broad lifecycle stage.
