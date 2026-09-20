# Event Model

## Event envelope

```json
{
  "eventId":"uuid",
  "eventType":"ApprovalDecided",
  "occurredAt":"ISO-8601",
  "aggregateType":"PROJECT",
  "aggregateId":"uuid",
  "actorUserId":"uuid",
  "actorPositionId":"uuid",
  "payload":{},
  "schemaVersion":1
}
```

## Events

### ProjectCreated

Payload: project facts, creator, initial status.

### WorkflowGenerated

Payload: workflow template/version, generated node list, rule-version IDs.

### ApprovalSubmitted

Payload: approval node, actor, evidence references.

### ApprovalDecided

Payload: decision, reason, authority rule/version.

### TaskAssigned

Payload: position, resolved user, due date.

### MilestoneUpdated

Payload: reported/verified progress.

### InspectionCompleted

Payload: result, observations, evidence.

### IssueRaised

Payload: issue category, owner, dependency links.

### ChangeRequested

Payload: cost/time/scope delta.

### ContractAwarded

Payload: contractor and external tender/award reference.

### WorkOrderIssued

Payload: work order metadata.

### ProjectCompleted

Payload: closure evidence and authorized actor.

## Event handling rules

- Transactional state change first.
- Publish event using an outbox table.
- Consumers are idempotent.
- Event publication failure does not roll back an already committed business action; retry via outbox.
