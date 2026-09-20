# 26 — Domain Model & Entity Relationships

## Goal

Define the canonical domain model for a configurable government infrastructure project without pretending that every department follows one identical process.

## Core aggregates

### Project aggregate

The central aggregate representing a proposed or executing infrastructure work.

```text
Project
 ├── Proposal
 ├── Site
 ├── Funding/Budget records
 ├── Sanctions
 ├── Clearances
 ├── Design/Estimate packages
 ├── Tender references
 ├── Contract
 ├── Work Order
 ├── Workflow Instance
 ├── Milestones
 ├── Tasks
 ├── Inspections
 ├── Measurements
 ├── Bills
 ├── Issues/Hindrances
 ├── Variations/Change Requests
 ├── Evidence/Documents
 ├── Completion/Handover
 └── DLP/Maintenance
```

## Organization aggregate

```text
Organization
 ├── Departments
 ├── Offices
 ├── Positions
 └── Jurisdiction assignments
```

A person is assigned to a position; the position belongs to an office; the office has an organizational and jurisdictional context.

## Rule aggregate

```text
RuleSource
 └── RuleVersion
       ├── Conditions
       ├── Actions
       └── Provenance
```

Rules are versioned independently of application releases.

## Workflow aggregate

```text
WorkflowTemplate
 ├── NodeTemplate
 └── EdgeTemplate

WorkflowInstance
 ├── NodeInstance
 └── Edge/Dependency state
```

## Entity definitions

### Project

Represents the work as a whole.

Key fields:

- id
- project_code
- name
- project_type
- department
- owning_office
- jurisdiction
- location
- estimated_cost
- funding_source
- current_state
- lifecycle_stage

### Proposal

Represents the initial statement of need, scope, preliminary estimate and submission.

### Site

Represents physical location and land/readiness information.

### Sanction

Represents a formal sanctioned decision such as administrative approval or technical sanction, subject to the applicable rule package.

### Clearance

Represents an approval/permission/NOC/clearance issued by an external or departmental authority when applicable.

### DesignEstimatePackage

Represents a versioned technical package containing drawings, BOQ, estimate, specifications and other design artifacts.

### Tender

Represents the procurement event or an external-system reference to one.

### Contract

Represents the awarded contractual relationship with the contractor/agency.

### WorkOrder

Represents authorization/instruction to commence the contractual work when applicable.

### Milestone

Represents a measurable project work stage. Exact milestone taxonomy is project-specific, not a universal government rule.

### Task

A unit of work assigned to a user/position.

### Inspection

A field/technical verification event connected to a milestone or work item.

### Measurement

A recorded quantity/measurement used for technical verification and potentially billing.

### Bill

A financial claim against executed/verified work, connected to contract and measurement records.

### Issue/Hindrance

A blocker, event, observation or impediment that can affect a project task/milestone.

### Variation/ChangeRequest

A proposed change to approved scope, quantity, time, technical solution or cost, with a derived re-approval workflow when required by verified rules.

### Evidence

A document/photo/record proving or supporting an action, state or measurement.

### Completion

The formal closeout process, including final inspection/certification and required documents.

### Handover

Transfer of the completed asset/work to the receiving/operating organization.

### DLP/Maintenance

Post-completion contractual defect-liability/maintenance tracking.

## Relationship map

```text
Department 1 ─── * Office
Office 1 ─── * Position
Position 1 ─── * UserPosition
User 1 ─── * UserPosition

Department 1 ─── * Project
Office 1 ─── * Project
Project 1 ─── * ProposalHistory
Project 1 ─── 0..1 Site
Project 1 ─── * Sanction
Project 1 ─── * Clearance
Project 1 ─── * DesignEstimatePackage
Project 1 ─── * TenderReference
Project 1 ─── 0..1 Contract
Contract 1 ─── * WorkOrder
Project 1 ─── 1 WorkflowInstance
WorkflowInstance 1 ─── * WorkflowNodeInstance
Project 1 ─── * Milestone
Project 1 ─── * Task
Project 1 ─── * Inspection
Milestone 1 ─── * Inspection
Project 1 ─── * Measurement
Project 1 ─── * Bill
Project 1 ─── * Issue
Project 1 ─── * Variation
Project 1 ─── * Evidence
Project 1 ─── 0..1 Completion
Completion 1 ─── 0..1 Handover
Project 1 ─── 0..1 DLP
```

## Cardinality rules

- A project can have multiple proposals/versions over time, but one current project state.
- A project can have multiple sanctions and clearances.
- A workflow instance is created from one workflow template version.
- A workflow node can create zero or more tasks depending on node type.
- A task may be assigned to a position and resolved to the active user holding that position.
- Evidence can be linked to multiple domain objects through a controlled association table, not arbitrary free-text links.
- Every rule-generated object stores the rule version that caused its creation.

## State separation

Do not overload `Project.status`.

Keep separate:

```text
project.lifecycle_stage
project.operational_status
workflow.state
approval.status
milestone.status
issue.status
payment.status
```

This avoids ambiguous states such as `PROJECT = PENDING`.

## Source-aware objects

The following objects should carry provenance where government rules or official documents drive their existence/requirements:

- Sanction
- Clearance
- WorkflowNodeInstance when rule-generated
- RequiredDocument
- AuthorityRequirement
- Rule-driven task
- Escalation triggered by an official or configured policy

## Domain principle

The database describes the project truth. Rules describe how that truth should produce workflow. AI describes/summarizes/recommends around the truth; it does not become the source of truth.
