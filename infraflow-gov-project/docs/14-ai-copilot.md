# 14 — AI Copilot

## Product goal

Use AI to reduce information-search and coordination effort while preserving human authority.

## Four AI modes

### 1. Explain

- Why is this approval required?
- What rule triggered this step?
- Why is the project blocked?
- What documents are missing?

### 2. Recommend

- What can be done next?
- Which independent tasks can be prepared in parallel?
- Which project issues deserve attention first?

### 3. Detect

- possible data inconsistency;
- potential missing document;
- estimate/version mismatch;
- progress/evidence inconsistency;
- duplicate evidence;
- unusual approval wait time.

### 4. Draft

- approval summary;
- inspection summary;
- project status report;
- issue escalation draft;
- meeting brief;
- action list.

## AI cannot

- approve or reject statutory/administrative decisions;
- choose a legally competent authority without a verified rule;
- override the workflow engine;
- mark a mandatory requirement as waived;
- alter an official record;
- invent a government rule/source;
- hide uncertainty.

## Grounded architecture

```text
Official source corpus
        +
Versioned verified rule registry
        +
Live project state
        +
Workflow graph
        ↓
Retrieval / structured context
        ↓
LLM
        ↓
Validated response
```

## Response contract

Every AI answer should return internally:

```json
{
  "answer": "...",
  "mode": "explain|recommend|detect|draft",
  "facts_used": ["..."],
  "rules_used": ["RULE-001"],
  "sources": ["SRC-001"],
  "confidence": "high|medium|low",
  "requires_human_review": true
}
```

## Source-first rule

If the model cannot retrieve a verified source for a legal/administrative claim, it must say that the rule is not verified and route the user to manual review/configuration.

## AI suggestions vs deterministic controls

Deterministic:

- authorization;
- mandatory gates;
- rule applicability;
- authority routing;
- dependency transitions;
- SLA arithmetic;
- project status changes.

AI:

- explanations;
- summaries;
- draft communications;
- anomaly hints;
- natural-language query interface.

## Suggested UI

```text
AI COPILOT

Current situation:
Project is waiting on Fire-related clearance.

Why:
The configured workflow has this clearance as a prerequisite for the next stage.

Source:
[View source]

Suggested next actions:
1. Review missing document checklist.
2. Contact assigned office.
3. Prepare independent tender documentation.

⚠ Suggestions are advisory.
```
