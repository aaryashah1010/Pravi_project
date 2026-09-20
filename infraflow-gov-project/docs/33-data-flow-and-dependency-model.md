# 33 — Data Flow & Dependency Model

## Project creation flow

```text
Project facts entered
      ↓
Validate required project facts
      ↓
Resolve organization/jurisdiction
      ↓
Select rule package effective on project date
      ↓
Evaluate verified/conditional rules
      ↓
Generate draft workflow graph
      ↓
Resolve authority requirements
      ↓
Create workflow instance
      ↓
Create ready tasks
      ↓
Audit + event
```

## Dependency types

### HARD_PREREQUISITE

Target cannot enter `READY` until the dependency is completed.

### SOFT_DEPENDENCY

Target can proceed but should be flagged as related.

### PARALLEL_COMPATIBLE

Activities may proceed independently.

### CONDITION_DEPENDENCY

Dependency applies only when a condition is true.

### EVIDENCE_DEPENDENCY

A node cannot complete until the required evidence exists and is valid.

### AUTHORITY_DEPENDENCY

A decision cannot be finalized without the required competent position/authority being resolved.

## Root blocker calculation

A blocker is a node/issue that:

1. is incomplete;
2. prevents one or more downstream required nodes;
3. has not been waived by an authorized process;
4. is not merely advisory.

Compute impact from the dependency graph, not from an LLM.

## Example

```text
Site Handover
      ↓ HARD_PREREQUISITE
Work Order
      ↓ HARD_PREREQUISITE
Construction Start
      ↓
Foundation
      ↓
Structure
```

If Site Handover is incomplete:

```text
Root blocker = Site Handover
Downstream blocked nodes = Work Order + Construction Start + Foundation + Structure
```

## AI relationship

AI receives:

- current workflow graph;
- node state;
- issue state;
- project facts;
- permitted source documents.

AI can produce:

- explanation;
- summary;
- suggested next action;
- possible anomaly;
- draft communication.

AI cannot alter the graph directly.

## Evidence flow

```text
User action
  ↓
Document/photo/form
  ↓
Evidence record
  ↓
Validation
  ↓
Link to project/stage/node
  ↓
Task/approval may advance
  ↓
Audit
```

## External system integration

```text
InfraFlow
   ├── existing government workflow/document system
   ├── Gujarat eProcurement / external procurement system
   ├── file/object storage
   └── future finance/ERP systems
```

Integration records must store external IDs and synchronization timestamps.
