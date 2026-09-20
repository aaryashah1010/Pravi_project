# 30 — Stitch UI Generation Prompt

## Product

InfraFlow — Government Infrastructure Lifecycle & Workflow Management Platform for Gujarat.

## Primary design goal

Create a credible enterprise/government operations web application, not a generic SaaS dashboard and not a flashy consumer app. The UI must communicate accountability, workflow, authority, traceability, project health, evidence, and actionability.

## Visual direction

Use a clean, institutional, modern interface inspired by high-quality enterprise operations software. Keep the visual language professional and calm. Avoid government-site clichés, excessive gradients, cartoon illustrations, giant marketing hero sections, excessive glassmorphism, neon colors, or “AI startup” aesthetics.

Use:

- light neutral background;
- high-contrast dark text;
- restrained use of blue/indigo as the primary action color;
- red/amber/green only for status semantics;
- compact but readable tables;
- 8px spacing system;
- rounded corners around 8–12px, not pill-heavy UI;
- subtle borders and shadows;
- strong hierarchy and clear typography;
- accessible contrast;
- responsive layout, but desktop-first because the primary users are government/engineering officers;
- tablet-friendly field inspection screens.

## Application shell

Create a persistent left sidebar and top utility bar.

### Sidebar

```text
InfraFlow logo

Overview
Dashboard
Projects
My Tasks
Approvals
Workflow
Construction
Inspections
Contractors
Documents
Issues & Hindrances
Variations
Reports

ADMINISTRATION
Organizations
Authority Rules
Workflow Rules
Audit Logs
Settings
```

Show only items allowed for the current user's permissions.

### Top bar

Include:

- department/office selector when permitted;
- global project search;
- notifications;
- current user's name/designation/office;
- help/source link area;
- profile menu.

## Dashboard page

This is the main government control-tower screen.

Header:

`Infrastructure Control Center`

Subtitle:

`Monitor project delivery, approvals, blockers and field execution.`

Top KPI cards:

```text
Active Projects
Pending Approvals
Projects At Risk
Blocked Projects
```

Below KPIs, create a “Requires Attention” section with high-priority project/action cards.

Example:

```text
Project INF-2026-00482
Government School — Ahmedabad

⚠ Root blocker: Site handover
Pending: 8 days
Downstream impact: 4 workflow activities
Owner: Executive Engineer / Ahmedabad Division

[View project]
```

Do not display invented legal rules. Use neutral labels such as “Configured prerequisite” where appropriate.

## Project detail page

This is the most important screen.

Header:

```text
Government School — Ahmedabad
INF-2026-00482

Status: Pre-Construction / At Risk
Department: Education
Location: Ahmedabad District, Taluka X
Estimated Cost: ₹12.4 Cr
```

Primary action buttons vary by permission:

`Continue Project` / `Review` / `Submit` / `Update Progress`

Tabs:

```text
Overview
Lifecycle
Approvals
Workflow
Construction
Inspections
Finance
Documents
Issues
Changes
Audit
AI Copilot
```

### Project Overview layout

Show:

1. Overall project health.
2. Planned vs actual progress.
3. Financial summary.
4. Current lifecycle stage.
5. Root blocker.
6. Next actions.
7. Latest evidence.
8. Timeline.

## Lifecycle page

Display a horizontal/vertical lifecycle timeline:

```text
Project Proposal
      ↓
Site / Land
      ↓
Sanctions
      ↓
Applicable Clearances
      ↓
Tender / Procurement
      ↓
Contract
      ↓
Work Order
      ↓
Construction
      ↓
Inspection / Measurement
      ↓
Billing
      ↓
Completion
      ↓
Handover
      ↓
DLP / Maintenance
```

Do not make it look like every project always has exactly the same steps. Show conditional stages with clear badges:

`Required`, `Conditional`, `Not applicable`, `Pending verification`.

## Workflow page

Create a professional dependency graph.

Example visual structure:

```text
             Administrative Approval
                       ✓
                       ↓
                 Technical Review
                       ✓
          ┌────────────┼────────────┐
          ↓            ↓            ↓
      Site Ready   Fund Check   Clearance
          ✓            ✓          ⚠
          └────────────┼────────────┘
                       ↓
                     Tender
                       ○
```

Each node should show:

- title;
- status;
- responsible position/office;
- days waiting;
- dependency count;
- source/rule badge if rule-generated.

Clicking a blocked node opens a right-side drawer:

```text
Why blocked?

Current blocker:
Site handover record pending

Impact:
4 downstream activities

Required action:
Verify site handover evidence

Source:
Rule R-...

[View source]
[View dependencies]
```

## Approval page

Use an approval table:

Columns:

```text
Approval
Status
Authority / Position
Office
Submitted
Age
Required Documents
Source
Action
```

Avoid displaying personal officer names to unauthorized users.

## Approval detail drawer

Include:

```text
Approval type
Project
Authority requirement
Current position holder
Jurisdiction
Prerequisites
Documents
Decision history
Source provenance
```

Decision actions:

```text
Approve
Return
Reject
Request information
```

Make rejection/return actions require a reason.

## Rule/source panel

This is a signature feature.

When a rule-driven workflow item is selected, display:

```text
Rule R-001
Status: VERIFIED

Requirement
[human-readable statement]

Triggered by
Project Type: Government Building

Source
Gujarat Public Works Manual / official source

Clause
[clause if verified]

Effective
[date]

[Open official source]
```

Never create fake clause numbers or fake citations in the UI.

## Construction page

Show:

- physical progress;
- planned vs actual;
- milestones;
- contractor;
- work order dates;
- latest site update;
- issues;
- inspection status.

Use a clean milestone table:

```text
Milestone | Planned | Actual | Progress | Inspection | Status
```

Add a progress chart but keep it restrained.

## Field inspection page

Design a tablet-friendly screen.

```text
Project
Milestone
Inspection date
GPS status

Checklist
☐ item
☑ item
☐ item

Photos / Evidence
[Upload]

Observation
[text area]

Result
Pass / Fail / Observation

[Submit Inspection]
```

Show a clear “Evidence captured” area for photos, timestamp and location metadata.

## Issues & hindrances page

Show issues as actionable cards/table.

Fields:

```text
Issue
Category
Opened
Age
Owner
Impact
Blocked Items
Status
```

Include a dependency impact drawer.

Example:

`Utility relocation → blocks Foundation → blocks Structure → affects 3 downstream milestones.`

## Variation page

Show:

```text
Original scope
Change requested
Cost impact
Time impact
Technical impact
Reason
Required re-approvals
Status
```

Make it clear that changing a sanctioned estimate is not an ordinary field edit.

## Contractor page

Internal officer view:

- assigned projects;
- contract value;
- progress;
- milestone submissions;
- issues;
- document compliance.

Contractor-specific portal should only expose assigned data.

## Documents page

Use a professional document-management table:

```text
Document
Type
Version
Uploaded by
Date
Linked stage
Verification
Source
```

Support preview and version history.

## Audit page

Make it visually strong because traceability is a core product principle.

Example:

```text
10:42 AM   Project submitted
           Junior Engineer · Ahmedabad Division

11:18 AM   Technical review assigned
           Workflow Engine

02:07 PM   Document requested
           Executive Engineer

04:13 PM   Document uploaded
           Junior Engineer
```

Include filters for actor, date, action and project stage.

## AI Copilot page

Do not make this a generic ChatGPT clone.

Header:

`InfraFlow Copilot`

Context banner:

`Context: INF-2026-00482 · Government School · Ahmedabad`

Suggested questions:

```text
What is blocking this project?
What can proceed in parallel?
Why is this approval required?
What documents are still missing?
Summarize the latest project changes.
```

AI responses should have a source section:

```text
Grounded in
✓ Project data
✓ Configured rule R-001
✓ Official source document

Mode: Advisory
```

Use a visible disclaimer:

`AI suggestions are advisory. Official decisions remain with authorized personnel.`

## Admin: Organization screen

Show a tree:

```text
Department
 ├── District
 │    ├── Taluka
 │    └── Office
 └── Engineering Office
      ├── Circle
      ├── Division
      └── Sub-Division
```

Right panel shows:

```text
Office details
Jurisdiction
Positions
Current holders
```

## Admin: Authority Rules screen

Use a rule table and a rule builder.

Fields:

```text
Rule ID
Approval Type
Department
Project Type
Jurisdiction
Conditions
Required Position
Effective From
Effective To
Status
Source
```

Provide a clear visual warning for:

`UNVERIFIED`

and prevent an unverified rule from silently becoming active.

## Admin: Workflow Rules screen

Show dependency graph editing with a non-code interface.

Users can define:

- node type;
- dependency;
- conditional branch;
- parallel path;
- escalation reference;
- evidence requirement;
- rule source.

## Responsive behavior

Desktop: 1440px+ optimized.

Laptop: 1280px.

Tablet: 768px+ for field inspection and approvals.

Mobile: basic monitoring and notifications; full construction data capture should work on tablet/mobile.

## Accessibility

- keyboard navigation;
- visible focus states;
- semantic buttons/links;
- accessible table labels;
- sufficient color contrast;
- status should never rely only on color;
- screen-reader-friendly form labels.

## Empty/loading/error states

Provide polished states:

- first project not created;
- no pending approvals;
- no issues;
- source unavailable;
- rule unverified;
- authority unresolved;
- document processing;
- AI unavailable.

Never show a fake successful state when a source or rule cannot be verified.

## Sample data for visual generation

Use fictional names and clearly synthetic project identifiers. Do not use real officer names, Aadhaar numbers, personal phone numbers, or real confidential government data.

Example:

```text
Project: Government School — Ahmedabad
Project ID: INF-2026-00482
Department: Education Department
Location: Ahmedabad District / Taluka X
Estimated Cost: ₹12.4 Cr
Status: At Risk
Progress: 42%
```

## Design output requested

Generate the following screens as one coherent enterprise product:

1. Login.
2. Control Center dashboard.
3. Project list.
4. Project overview.
5. Lifecycle.
6. Workflow dependency graph.
7. Approval inbox.
8. Approval detail.
9. Construction monitoring.
10. Field inspection.
11. Issues/hindrances.
12. Variations.
13. Documents.
14. Audit timeline.
15. AI Copilot.
16. Organization admin.
17. Authority Rules admin.
18. Workflow Rules admin.

Keep the same design system, spacing, typography, tables, status badges and interaction patterns across all screens.

The product should feel like an operational system that a state government department could actually use—not a pitch-deck mockup.
