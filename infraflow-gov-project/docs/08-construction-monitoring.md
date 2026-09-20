# 08 — Construction Monitoring

## Goal

Connect field execution to the approved project structure and make reported progress traceable.

## Milestone model

```text
Milestone
- id
- project_id
- code
- name
- planned_start
- planned_finish
- actual_start
- actual_finish
- planned_progress
- reported_progress
- verified_progress
- status
- dependency_state
```

## Site update

A contractor or field user can submit:

- progress percentage;
- quantity/work item update;
- photos;
- site note;
- labour report where configured;
- material record where configured;
- inspection request;
- hindrance/issue;
- measurement evidence.

## Field evidence

Capture where appropriate:

- project ID;
- milestone/work item ID;
- uploaded by;
- timestamp;
- device metadata if available;
- GPS coordinates if captured and permitted;
- image/file hash;
- evidence type;
- description.

## Official Gujarat evidence/data alignment

An official Gujarat civil technical specification lists site documents including contract documents/drawings, computerized bill format, Site Order Book, material testing/quality inspection reports, computerized measurement books, progress bar chart, sample approval register, Hindrance Register, Work Diary, deviation/variation order registers, material/reinforcement/concrete/slump-related registers, requests for work inspection, Joint Measurement Book, daily labour report and quality checklist.

The prototype should model these categories where relevant but should not falsely imply that every item is mandatory for every project or contract.

## Planned vs actual

Display:

```text
Planned progress: 71%
Verified progress: 58%
Variance: -13 percentage points
```

Do not silently use contractor-reported progress as verified progress.

## Inspection flow

```text
Contractor / field request
       ↓
Inspection assigned
       ↓
Inspector visits site
       ↓
Checklist + measurements + evidence
       ↓
PASS / FAIL / OBSERVATION
```

If failed:

```text
FAIL
 ↓
Observation/rectification task
 ↓
Correction evidence
 ↓
Re-inspection
 ↓
PASS
```

## AI vision

AI may flag possible inconsistencies between reported progress and image evidence.

AI output is advisory:

- possible inconsistency;
- missing expected evidence;
- image quality issue;
- potential duplicate image.

Human inspector remains responsible for the official inspection decision.
