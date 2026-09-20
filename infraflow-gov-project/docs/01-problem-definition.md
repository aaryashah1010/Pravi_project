# 01 — Problem Definition

## Problem statement

Build an enhanced workflow-management and construction-project monitoring system for improved infrastructure delivery.

## Interpretation

The target problem is not merely construction progress reporting.

It is the coordination of the full project lifecycle in which multiple government offices, engineering functions, competent authorities, contractors, inspectors, finance/procurement processes, documents, approvals, dependencies and site events interact.

## Existing-system reality

Gujarat already has generic government workflow/document infrastructure. GIL describes IWDMS as an integrated workflow and document management platform covering workflow, organization model, security/access control, dashboards, policy-based processing, knowledge management, task prioritization, reminders, interdepartmental interface and audit trails. GIL reports 21,460+ users across departments/HODs and 27 departments as of 31 Dec 2019.

Gujarat also operates an eProcurement platform through (n)Code/nProcure for electronic tendering and related procurement processes.

Therefore the project should not be pitched as "we digitized government files" or "we built another tender portal".

## Target gap

InfraFlow targets the construction-specific orchestration layer:

- derive an applicable workflow from project attributes and source-backed rules;
- route actions to a position/office/jurisdiction rather than hard-code individual people;
- model sequential, parallel, conditional and blocking dependencies;
- make the current root blocker visible;
- connect approval readiness to construction readiness;
- collect structured field evidence;
- track inspections, measurements, hindrances and variations;
- show planned versus actual progress;
- keep all actions and evidence auditable;
- provide AI-assisted explanation, anomaly detection and next-action recommendations grounded in verified rules.

## Problem hypotheses

H1: Project delays are often caused by dependencies across administrative, technical, procurement, land/site and inspection processes, not only by physical construction productivity.

H2: A project status page alone does not reveal the root dependency or the next accountable action.

H3: Government authority routing must use organizational position, office and delegated powers, not hard-coded usernames.

H4: Rule applicability changes by project attributes; therefore workflows should be generated from versioned rules.

H5: AI is useful for explanation and assistance but should not replace authorized human decision-making.

## Non-goals

- Replacing all existing state procurement systems.
- Making statutory decisions autonomously.
- Claiming complete legal coverage of Gujarat.
- Inventing authority thresholds or universal NOCs.
- Predicting exact project completion dates without a valid model and evidence.
- Automatically rejecting applications using an LLM.
