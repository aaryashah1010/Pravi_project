# 07 — Workflow and Dependency Engine

## Goal

Represent real projects as a directed dependency graph rather than a single fixed sequence.

## Dependency types

### FINISH_TO_START
Task B can start after Task A completes.

### START_TO_START
Task B may start after Task A starts.

### FINISH_TO_FINISH
Task B should not finish before Task A finishes.

### BLOCKS
A blocker prevents downstream execution.

### ENABLES
A completed step enables another step.

### CONDITIONAL
A relationship activates only when a condition is true.

### PARALLEL
Independent tasks are intentionally allowed to run together.

## Workflow node types

- Approval
- Clearance
- Task
- Document requirement
- Inspection
- Milestone
- Measurement
- Bill
- Contract action
- Handover action
- Closure action

## Example graph

```text
Administrative Approval
          ↓
Technical Sanction
          ↓
      ┌───┴───────────┐
      ↓               ↓
Building/other     Fund readiness
clearance             check
      │               │
      └───────┬───────┘
              ↓
            Tender
              ↓
           Contract
              ↓
          Work Order
              ↓
        Construction
              ↓
        Inspection
              ↓
          Milestone
              ↓
        Measurement
              ↓
             Bill
              ↓
          Payment
```

The exact nodes and edges are produced by rule templates for the selected project type.

## Root blocker detection

A blocker is a current unsatisfied node that prevents one or more downstream nodes from becoming ready.

Compute:

- blocked node;
- path count or downstream node count;
- direct owner;
- age of blocker;
- SLA status;
- downstream impact;
- evidence of delay.

Do not call an item a legal blocker unless a verified rule says it is a mandatory gate.

## Parallel work suggestion

The engine can identify independent nodes that are currently eligible to be prepared in parallel.

This is an operational optimization, not a legal rule, unless explicitly backed by a rule.

## State transition guard

Every transition must pass:

1. role/authority permission;
2. current workflow state;
3. required prerequisites;
4. required evidence/documents;
5. versioned rule conditions;
6. concurrency/version check;
7. audit logging.

## Idempotency

Repeated submissions must not produce duplicate approvals or duplicate downstream tasks.

Use a deterministic workflow-instance + node-instance key.
