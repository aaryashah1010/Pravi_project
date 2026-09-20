# 39 — Rule Engine Safe Behavior

## Objective

Prevent InfraFlow from silently converting assumptions into government rules.

## Hard safety constraints

### 1. No rule without provenance

Every deterministic rule must reference a Rule Source and Rule Version.

### 2. No authority based only on designation name

`Executive Engineer` does not by itself mean “can approve this project.” Authority resolution must use the applicable delegation rule, department, office/jurisdiction and project attributes.

### 3. No hard-coded monetary authority thresholds unless current source-backed

Thresholds from the 2020 manual that are explicitly stated but whose current amendment status is unknown must not block or route production decisions.

### 4. Department-specific rules stay department-specific

A WRD rule cannot be copied into R&B simply because both departments share the Engineering Works Manual.

### 5. Conditional clearances remain conditional

Example:

`LOCAL_BODY_APPROVAL_REQUIRED = true`

must be determined by an applicability rule. The engine must not assume that every government building needs the same clearance or the same approving body.

### 6. Contract-specific conditions stay contract-specific

A tender document can create a contract obligation without becoming a universal government rule.

### 7. AI cannot upgrade rule status

AI may identify a candidate source/rule. Only a rule-review workflow may promote it into an executable verified rule.

## Engine outcomes

For a requested action, the engine returns one of:

- `ALLOWED`
- `BLOCKED_BY_VERIFIED_RULE`
- `REQUIRES_HUMAN_REVIEW`
- `AUTHORITY_UNRESOLVED`
- `RULE_NOT_CONFIGURED`
- `RULE_CONFLICT`
- `SOURCE_OUTDATED_OR_UNKNOWN`

## Example

Input:

```text
Project type = Government Building
Department = R&B
Estimated cost = Rs. 40 lakh
District = Ahmedabad
```

If current R&B AA/TS monetary delegation is not verified:

```text
Authority resolution:
REQUIRES_HUMAN_REVIEW

Reason:
Applicable R&B delegation threshold is not currently verified.

The engine must NOT invent a District/SE/CE assignment.
```

This is preferable to a false confident routing decision.
