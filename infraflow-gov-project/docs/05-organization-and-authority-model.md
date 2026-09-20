# 05 — Organization and Authority Model

## Principle

The platform must represent **organization structure** separately from **decision authority**.

## Organization hierarchy

A configurable organization graph can represent:

```text
State Government
└── Department
    ├── Directorate / Head Office
    ├── District Office
    │   ├── Taluka Office
    │   └── Other Field Office
    └── Engineering Organization
        ├── Circle
        ├── Division
        └── Sub-Division
```

This is only a data model example. The actual hierarchy must be loaded from the selected department's authoritative organization records.

## Position model

```text
Position
- id
- designation
- office_id
- authority_profile_id
- active_from
- active_to
```

## User-position assignment

```text
UserPosition
- user_id
- position_id
- start_at
- end_at
- assignment_type
- active
```

Assignment types can include substantive post, additional charge, temporary assignment or other officially recognized status if configured.

## Authority profile

Authority is defined through:

- decision type;
- project/work type;
- department/organization scope;
- geographical/jurisdiction scope;
- financial/value conditions where an official delegation rule exists;
- other conditions explicitly supported by source documents;
- effective dates;
- source provenance.

## Competent authority resolution

Pseudo-flow:

```text
Project facts
    ↓
Applicable authority rules
    ↓
Candidate competent position(s)
    ↓
Jurisdiction filtering
    ↓
Active position holder resolution
    ↓
Current user/task assignment
```

## No invented thresholds

Do not hard-code a threshold such as `₹10 Cr -> District Authority` unless the applicable official delegation instrument explicitly states that rule and our source record contains its citation.

## Conflict handling

If two active rules appear to conflict:

1. Do not silently choose a rule.
2. Compare effective dates and supersession metadata.
3. Check whether they have different scope.
4. Mark the rule set as `CONFLICT_REQUIRES_REVIEW` if unresolved.
5. Prevent automatic routing where the conflict changes a legal/approval outcome.

## Transfer handling

Existing tasks route to the position, not permanently to a person's identity.

Example:

```text
Task requires:
Executive Engineer / Ahmedabad Division

Current holder:
User A

User A transferred

Current holder:
User B

Task remains attached to position and resolves to User B.
```

## Delegation and additional charge

The data model must allow the source authority to define whether an acting/additional-charge arrangement changes who can act. This is a rule question, not an assumption.
