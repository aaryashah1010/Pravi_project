# Rule Cards — Initial Source-Backed Set

This file converts the initial rule registry into implementation-friendly cards.

## RC-001 — Engineering proposal

```yaml
rule_id: RULE-001
status: VERIFIED
scope: "engineering-work domain as supported by source"
when: "engineering work proposal is being prepared"
then:
  action: "require project proposal with cost estimate"
source:
  source_id: SRC-003
  citation: "engineering work execution provision; exact clause/page to be captured in rule-source archive"
```

## RC-002 — Administrative approval / technical sanction where required

```yaml
rule_id: RULE-002
status: VERIFIED
scope: "engineering-work domain as supported by source"
then:
  action: "evaluate applicable administrative approval and technical sanction requirements"
important: "do not infer exact authority or threshold from this rule alone"
source:
  source_id: SRC-003
```

## RC-003 — Tendering under applicable rules

```yaml
rule_id: RULE-003
status: VERIFIED
scope: "engineering-work domain as supported by source"
then:
  action: "route procurement activity according to applicable procurement rules"
source:
  source_id: SRC-003
```

## RC-004 — Monitoring/inspection

```yaml
rule_id: RULE-004
status: VERIFIED
scope: "engineering-work domain as supported by source"
then:
  action: "enable monitoring and periodic inspection records"
source:
  source_id: SRC-003
```

## RC-005 — Design approval before commencement

```yaml
rule_id: RULE-006
status: VERIFIED
scope: "Gujarat Public Works Manual application cited by official R&B audit"
when: "work commencement is being considered"
then:
  gate: "approved detailed design required"
source:
  source_id: SRC-002
```

## RC-006 — Land made over before commencement

```yaml
rule_id: RULE-007
status: VERIFIED
scope: "Gujarat Public Works Manual application cited by official R&B audit"
when: "work commencement is being considered"
then:
  gate: "land duly made over requirement must be satisfied"
source:
  source_id: SRC-002
```

## RC-007 — Site records

```yaml
rule_id: RULE-010
status: VERIFIED
scope: "referenced Gujarat civil technical specification"
then:
  action: "enable site record checklist according to the applicable project/contract specification"
source:
  source_id: SRC-004
```

## RC-008 — DLP

```yaml
rule_id: RULE-012
status: CONTRACT-SPECIFIC
scope: "individual contract"
when: "contract contains DLP term"
then:
  action: "derive DLP dates from contract"
source:
  source_id: "relevant contract source"
```

## Important implementation constraint

These cards are intentionally incomplete for authority thresholds and statutory clearances. Do not create missing rules in code to make the demo flow more convenient. Use `MANUAL_REVIEW` when the rule registry lacks a verified rule.
