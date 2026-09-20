# 02 — Domain Understanding

## Domain language

### Project
A government/public infrastructure initiative that may result in construction or improvement of a physical asset.

### Proposal
The initial structured request describing the need, scope, location and preliminary cost before full execution.

### Work
The executable engineering/construction activity represented by a project.

### Sanction
A formal authorized decision relevant to project expenditure or technical execution. The model keeps administrative approval and technical sanction as distinct types when applicable.

### Clearance
A permission/NOC or other external/internal prerequisite whose applicability must be derived from the applicable rule set.

### Authority
A decision-making capacity assigned to a position under a scope of jurisdiction and applicable delegation.

### Position
An organizational post/designation that can hold authority. A user occupies a position for a period of time.

### Office
An organizational unit with jurisdiction and parent-child structure.

### Task
An action assigned to a user/position.

### Dependency
A relationship determining whether one activity can start/finish or whether its state affects another activity.

### Gate
A mandatory condition that must be satisfied before the workflow can cross a defined transition.

### Milestone
A measurable project execution stage.

### Inspection
A structured verification activity performed by an authorized field/technical role.

### Evidence
A document, image, record, measurement or other artifact supporting a project state/action.

### Measurement
A recorded quantity of work performed and verified for the relevant work item.

### Bill
A financial claim tied to contract/work/measurements and subjected to configured technical and financial processing.

### Hindrance
An event/condition preventing or affecting planned execution.

### Variation
A proposed change to scope, quantity, cost, time or technical requirements.

### Handover
Transfer of a completed asset/work to the receiving operational entity.

### DLP
Defect liability period where applicable under the contract/project.

## Four different workflow objects

1. Gate — must be satisfied.
2. Dependency — determines relationship/order/impact.
3. Task — somebody must act.
4. Evidence — proves an action/state.

## Why this separation matters

A pending document is not the same thing as a pending approval.

An approval is not the same thing as a task.

A construction milestone is not proof by itself that construction occurred.

A contractor's progress submission is not the same thing as a verified inspection.

The system should keep these objects separate so that the project state remains explainable.
