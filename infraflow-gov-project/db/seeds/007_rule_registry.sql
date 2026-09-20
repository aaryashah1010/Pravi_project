-- Rule registry pack v1. Source of truth for every string here: docs 22, 37, 38 (rule-cards).
-- Nothing is invented: citation locators are only those stated in the docs; otherwise "Locator to be captured".
-- Rules not in docs/38 as ACTIVE_VERIFIED are NOT enforceable (advisory/conditional) or absent.
-- The DEMO-AUTH-* rules are SYNTHETIC (source SRC-DEMO-SYNTHETIC, scope.synthetic=true).
-- Idempotent.

-- Sources -------------------------------------------------------------------------
INSERT INTO rule_sources (source_code, title, issuing_authority, source_type, scope_department, scope_jurisdiction,
                          official_url, retrieved_at, source_status, verification_level, notes)
VALUES
 ('SRC-EWM-2020',
  'Gujarat Engineering Works Manual 2020, Volume I',
  'Government of Gujarat (R&BD / WRD engineering works)',
  'MANUAL', 'R&B/WRD', 'Gujarat',
  'https://guj-nwrws.gujarat.gov.in/showpage.aspx/pdf/downloads/gr/gr_tank/showpage.aspx?contentid=2403&lang=English',
  TIMESTAMPTZ '2026-09-20 00:00:00+00', 'ACTIVE', 'OFFICIAL_SECONDARY',
  'Official manuals page lists the manual; text cross-checked against a hosted copy. Currentness/amendment check required before legal-production use (docs 37/38).'),
 ('SRC-GJ-RNB-AUDIT',
  'Gujarat R&B audit report (official government site) citing the Gujarat Public Works Manual',
  'Government of Gujarat (official audit material)',
  'AUDIT_DOCUMENT', 'R&B', 'Gujarat',
  NULL, TIMESTAMPTZ '2026-09-20 00:00:00+00', 'ACTIVE', 'OFFICIAL_SECONDARY',
  'Quotes Public Works Manual pre-commencement requirements. Scope: the cited manual application (docs 22).'),
 ('SRC-GJ-NOTIF',
  'Gujarat government notification reproducing engineering-work execution provisions',
  'Government of Gujarat',
  'GOVERNMENT_ORDER', 'General engineering works', 'Gujarat',
  NULL, TIMESTAMPTZ '2026-09-20 00:00:00+00', 'ACTIVE', 'PRIMARY_OFFICIAL',
  'Domain-backbone provisions only. Does not establish any authority or monetary threshold (docs 22).'),
 ('SRC-GJ-CIVIL-SPEC',
  'Gujarat civil technical specification (site records) and individual contract terms',
  'Government of Gujarat (specification / contract source)',
  'OTHER', 'Referenced specification / contract', 'Gujarat',
  NULL, TIMESTAMPTZ '2026-09-20 00:00:00+00', 'ACTIVE', 'CONTRACT_SOURCE',
  'CONTRACT-SPECIFIC: applies only where the referenced specification/contract says so. Do not generalize.'),
 ('SRC-WRD-DECISION',
  'Gujarat Narmada, Water Resources, Water Supply and Kalpsar Department - decision process page (new scheme approvals)',
  'Government of Gujarat, Water Resources Department',
  'OFFICIAL_WEBSITE', 'WRD', 'Gujarat',
  'https://guj-nwrws.gujarat.gov.in/showpage.aspx/mediafiles/pdf/forms/showpage.aspx?contentid=4067&lang=English',
  TIMESTAMPTZ '2026-09-20 00:00:00+00', 'ACTIVE', 'PRIMARY_OFFICIAL',
  'WRD-SPECIFIC. Must NOT be generalized to R&B (docs 37/38/39).'),
 ('SRC-DEMO-SYNTHETIC',
  'SYNTHETIC DEMO DELEGATION - NOT A REAL GOVERNMENT RULE',
  'InfraFlow prototype (synthetic demo data)',
  'OTHER', 'DEMO-GOV', 'DEMO-GUJARAT',
  NULL, NULL, 'ACTIVE', 'SECONDARY',
  'Synthetic thresholds so the demo workflow can route end-to-end. Applies only to the synthetic DEMO-GOV department. Not derived from any government instrument.')
ON CONFLICT (source_code) DO NOTHING;

-- Rule versions -----------------------------------------------------------------------
-- enforcement: ENFORCEABLE (executable), ADVISORY_ONLY (displayed, never blocks), verification is VERIFIED for all seeded rows
-- (registry is a prototype pending departmental/legal review; see scope.registry_note).
INSERT INTO rule_versions (rule_code, version_no, rule_name, rule_category, scope, conditions, action,
                           enforcement_mode, verification_status, effective_from, effective_to, source_id,
                           verified_by, verified_at)
SELECT m.rule_code, 1, m.rule_name, m.rule_category,
       m.scope::jsonb || jsonb_build_object('registry_note', 'Prototype registry seeded from project docs; pending departmental/legal review'),
       m.conditions::jsonb, m.action::jsonb, m.mode, 'VERIFIED', m.eff_from::date, NULL, s.id,
       (SELECT id FROM app_users WHERE lower(email) = 'admin@demo.infraflow.local'), now()
FROM (VALUES
 -- General engineering-works backbone (GJ notification) ---------------------------------
 ('RULE-001', 'Engineering proposal with cost estimate', 'PREREQUISITE', 'ENFORCEABLE', 'SRC-GJ-NOTIF', NULL,
  $j${"domain":"engineering-work","projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Engineering work process includes preparation of a proposal with a cost estimate.","note":"Does not establish any approval authority or threshold."}$j$),
 ('RULE-004', 'Periodic monitoring and inspection of engineering works', 'EXECUTION', 'ENFORCEABLE', 'SRC-GJ-NOTIF', NULL,
  $j${"domain":"engineering-work","projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Engineering works are to be monitored and inspected periodically.","enables":"monitoring_and_inspection_records"}$j$),
 ('RULE-005', 'Work records must be maintained', 'DOCUMENT', 'ENFORCEABLE', 'SRC-GJ-NOTIF', NULL,
  $j${"domain":"engineering-work","projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Engineering works require maintenance of records."}$j$),
 -- Public Works Manual pre-commencement requirements (R&B audit report) ------------------
 ('RULE-006', 'Detailed design approved before work commencement', 'PREREQUISITE', 'ENFORCEABLE', 'SRC-GJ-RNB-AUDIT', NULL,
  $j${"manual":"Gujarat Public Works Manual (as cited by official R&B audit)","projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Works are to commence only after the detailed design of structures is approved.","gate":"approved_detailed_design_before_commencement"}$j$),
 ('RULE-007', 'Land duly made over before work commencement', 'PREREQUISITE', 'ENFORCEABLE', 'SRC-GJ-RNB-AUDIT', NULL,
  $j${"manual":"Gujarat Public Works Manual (as cited by official R&B audit)","projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Work should not commence on land that has not been duly made over by the responsible civil officer.","gate":"land_made_over_before_commencement"}$j$),
 -- Engineering Works Manual 2020 Vol I (docs 38 ACTIVE_VERIFIED) ------------------------
 ('RNB-WF-001', 'Initiation prerequisites before normal commencement', 'PREREQUISITE', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Before normal work commencement, the project should have the applicable budget provision, Administrative Approval, a properly prepared detailed estimate with Technical Sanction, and fund allotment/availability as required by the manual's initiation rule."}$j$),
 ('RNB-WF-002', 'Administrative Approval definition', 'WORKFLOW', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Administrative Approval is the competent authority's formal acceptance of the proposal to execute the specified work at the stated sum.","note":"Does not establish who is competent or any monetary threshold."}$j$),
 ('RNB-TS-001', 'Technical Sanction of a properly detailed estimate', 'PREREQUISITE', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"A properly detailed estimate requires Technical Sanction by the competent technical authority before normal execution.","note":"Does not establish who is competent or any monetary threshold."}$j$),
 ('RNB-WF-003', 'Detailed estimate follows Administrative Approval', 'WORKFLOW', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Detailed estimate preparation follows Administrative Approval; for building projects the estimate/design package must contain the technical information necessary for a sound estimate."}$j$),
 ('RNB-WF-004', 'Staged approvals where land acquisition / service shifting is a construction prerequisite', 'WORKFLOW', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"],"conditional":true}$j$,
  $j${"all":[{"fact":"attributes.requires_land_acquisition","op":"eq","value":true}]}$j$,
  $j${"statement":"Where major works require land acquisition, service shifting or tree cutting as construction prerequisites, the manual describes staged administrative approvals and a dependency on progress of those prerequisite activities.","note":"Applicability must be explicit; do not apply to every project."}$j$),
 ('RNB-WF-005', 'Revised Administrative Approval where detailed estimate exceeds AA by more than 10%', 'VARIATION', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$,
  $j${"all":[{"fact":"variation.detailed_estimate_ratio","op":"gt","value":1.10}]}$j$,
  $j${"statement":"Revised Administrative Approval is to be considered where approved proposal modifications/deviations trigger a revised estimate and where a detailed estimate exceeds the administratively approved amount by more than 10%, subject to the manual's detailed conditions.","note":"2020 manual; check later amendments before production use."}$j$),
 ('RNB-WF-006', 'Excess cannot be used to change approved scope', 'VARIATION', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"The amount of excess may not be used as a hidden mechanism to change the approved scope/plan."}$j$),
 ('RNB-TND-001', 'Draft Tender Paper approved by competent tender-accepting authority', 'PROCUREMENT', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"Draft Tender Paper/tender documents require approval by the authority competent to accept the tender before the work is given out on contract.","note":"Exact current tender-acceptance monetary limits are NOT verified."}$j$),
 ('RNB-CNT-001', 'Contract documents complete before tender acceptance', 'PROCUREMENT', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"]}$j$, $j${}$j$,
  $j${"statement":"No tender should be accepted before the contract documents are completed in all respects, subject to the manual's exceptional start provisions."}$j$),
 ('RNB-BLD-002', 'Local-body approval before award where required (conditional)', 'CLEARANCE', 'ENFORCEABLE', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"],"conditional":true}$j$,
  $j${"all":[{"fact":"attributes.local_body_approval_required","op":"eq","value":true}]}$j$,
  $j${"statement":"Where local-body approval is required, it should be available before award and the owner department is responsible for obtaining it.","note":"Applicability depends on planning jurisdiction / project type / applicable regulation; the applicability resolver is not yet verified, so it is a project fact."}$j$),
 ('RNB-CNT-002', 'Start before signed tender documents is an exceptional, recorded case', 'PROCUREMENT', 'ADVISORY_ONLY', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"],"exception":true}$j$, $j${}$j$,
  $j${"statement":"Starting before signed tender documents is an exceptional, recorded-reason case that must be intimated to Government.","mode":"MANUAL_REVIEW_EXCEPTION","note":"Never a default workflow branch."}$j$),
 -- Verified in the 2020 manual but currentness of monetary threshold not established: ADVISORY ONLY -------
 ('RNB-BLD-001', 'Architect route for building projects at or above Rs. 25 lakh (2020 manual)', 'PREREQUISITE', 'ADVISORY_ONLY', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"],"currency_check_required":true}$j$,
  $j${"all":[{"fact":"project.estimated_cost","op":"gte","value":2500000}]}$j$,
  $j${"statement":"For building projects at or above Rs. 25 lakh, the 2020 manual directs the requisitioning department to approach the Chief Architect for architectural drawings; below Rs. 25 lakh, the Executive Engineer of R&BD may be approached directly.","currency_check_required":true,"note":"Do not activate as a 2026 monetary trigger until an amendment/currency check is documented."}$j$),
 ('RNB-TND-002', 'e-Procurement for works above Rs. 3 lakh (2020 manual)', 'PROCUREMENT', 'ADVISORY_ONLY', 'SRC-EWM-2020', NULL,
  $j${"department":["R&B","WRD"],"projectTypes":["GOV_BUILDING"],"currency_check_required":true}$j$,
  $j${"all":[{"fact":"project.estimated_cost","op":"gt","value":300000}]}$j$,
  $j${"statement":"The 2020 manual states that works above Rs. 3 lakh are to use e-procurement.","currency_check_required":true,"note":"Do not treat the Rs. 3 lakh threshold as a 2026 active threshold until checked against current procurement instructions."}$j$),
 -- Contract-specific -------------------------------------------------------------------
 ('RULE-010', 'Site record categories (specification-specific)', 'DOCUMENT', 'ADVISORY_ONLY', 'SRC-GJ-CIVIL-SPEC', NULL,
  $j${"contractSpecific":true}$j$, $j${}$j$,
  $j${"statement":"The referenced specification lists site documents (site order book, quality inspection records, measurement books, progress chart, hindrance register, work diary, variation registers, inspection requests, quality checklist). Not automatically universal across projects."}$j$),
 ('RULE-012', 'Defect liability period is contract-specific', 'COMPLETION', 'ADVISORY_ONLY', 'SRC-GJ-CIVIL-SPEC', NULL,
  $j${"contractSpecific":true}$j$, $j${}$j$,
  $j${"statement":"A contract can specify a DLP period and rectification obligations. The exact duration must be read from the relevant contract; there is no universal DLP value."}$j$),
 -- WRD-specific (stored, never applied to R&B) ---------------------------------------------
 ('WRD-AA-001', 'WRD new-scheme Administrative Approval matrix (WRD-specific)', 'AUTHORITY', 'ENFORCEABLE', 'SRC-WRD-DECISION', NULL,
  $j${"department":["WRD"],"wrdSpecific":true,"note":"Must NOT be used for R&B."}$j$, $j${}$j$,
  $j${"statement":"For the WRD new-scheme AA process: up to Rs. 30 lakh - Chief Engineer + Additional Secretary level; above Rs. 30 lakh to Rs. 1 crore - Secretary, WRD, with Financial Advisor consultation; above Rs. 1 crore to Rs. 5 crore - Additional Chief Secretary (Expenditure/Finance); above Rs. 5 crore - Additional Chief Secretary, Finance Department.","matrix_rows":4}$j$),
 -- SYNTHETIC demo delegation (DEMO-GOV only) -------------------------------------------------
 ('DEMO-AUTH-AA', 'SYNTHETIC: Administrative Approval delegation (DEMO-GOV)', 'AUTHORITY', 'ENFORCEABLE', 'SRC-DEMO-SYNTHETIC', '2026-01-01',
  $j${"synthetic":true,"departments":["DEMO-GOV"]}$j$, $j${}$j$,
  $j${"statement":"SYNTHETIC DEMO: up to INR 5 Cr - Executive Engineer; above INR 5 Cr - Superintending Engineer. Not a real government rule."}$j$),
 ('DEMO-AUTH-TS', 'SYNTHETIC: Technical Sanction delegation (DEMO-GOV)', 'AUTHORITY', 'ENFORCEABLE', 'SRC-DEMO-SYNTHETIC', '2026-01-01',
  $j${"synthetic":true,"departments":["DEMO-GOV"]}$j$, $j${}$j$,
  $j${"statement":"SYNTHETIC DEMO: up to INR 15 Cr - Executive Engineer; above INR 15 Cr - Superintending Engineer. Not a real government rule."}$j$),
 ('DEMO-AUTH-DTP', 'SYNTHETIC: Draft Tender Paper approval delegation (DEMO-GOV)', 'AUTHORITY', 'ENFORCEABLE', 'SRC-DEMO-SYNTHETIC', '2026-01-01',
  $j${"synthetic":true,"departments":["DEMO-GOV"]}$j$, $j${}$j$,
  $j${"statement":"SYNTHETIC DEMO: up to INR 5 Cr - Executive Engineer; above INR 5 Cr - Superintending Engineer. Not a real government rule."}$j$),
 ('DEMO-AUTH-COMPLETION', 'SYNTHETIC: Completion certification delegation (DEMO-GOV)', 'AUTHORITY', 'ENFORCEABLE', 'SRC-DEMO-SYNTHETIC', '2026-01-01',
  $j${"synthetic":true,"departments":["DEMO-GOV"]}$j$, $j${}$j$,
  $j${"statement":"SYNTHETIC DEMO: completion certification by the Executive Engineer. Not a real government rule."}$j$)
) AS m(rule_code, rule_name, rule_category, mode, source_code, eff_from, scope, conditions, action)
JOIN rule_sources s ON s.source_code = m.source_code
ON CONFLICT (rule_code, version_no) DO NOTHING;

-- Citations (locators exactly as given in docs 37/38; otherwise "Locator to be captured") ----------------
INSERT INTO rule_citations (rule_version_id, citation_type, locator, notes)
SELECT rv.id, c.ctype, c.locator, c.notes
FROM (VALUES
 ('RNB-WF-001', 'SECTION', 'Volume I, Section 3.2', NULL),
 ('RNB-WF-002', 'SECTION', 'Volume I, Section 3.2.2', NULL),
 ('RNB-TS-001', 'SECTION', 'Volume I, Section 3.2.3', NULL),
 ('RNB-WF-003', 'SECTION', 'Volume I, Sections 3.2.2-3.4', NULL),
 ('RNB-WF-004', 'SECTION', 'Volume I, Section 3.2.2(b)', 'Applicability must be explicit'),
 ('RNB-WF-005', 'SECTION', 'Volume I, Section 3.2.2(d)', NULL),
 ('RNB-WF-006', 'SECTION', 'Volume I, Section 3.2.2(d)', NULL),
 ('RNB-TND-001', 'SECTION', 'Volume I, Section 3.5', NULL),
 ('RNB-CNT-001', 'SECTION', 'Volume I, Section 3.5.23', NULL),
 ('RNB-CNT-002', 'SECTION', 'Volume I, Section 3.5', NULL),
 ('RNB-BLD-001', 'SECTION', 'Volume I, Section 3.2.2(a)', 'Currency check required'),
 ('RNB-BLD-002', 'OTHER',   'Volume I, building requirements section (exact clause locator to be captured)', NULL),
 ('RNB-TND-002', 'SECTION', 'Volume I, Section 3.5.4', 'Currency check required'),
 ('RULE-001', 'OTHER', 'Locator to be captured (engineering-work execution provision)', NULL),
 ('RULE-004', 'OTHER', 'Locator to be captured (engineering-work execution provision)', NULL),
 ('RULE-005', 'OTHER', 'Locator to be captured (engineering-work execution provision)', NULL),
 ('RULE-006', 'OTHER', 'Locator to be captured (Public Works Manual as cited in the audit report)', NULL),
 ('RULE-007', 'OTHER', 'Locator to be captured (Public Works Manual as cited in the audit report)', NULL),
 ('RULE-010', 'OTHER', 'Locator to be captured (site documents list in the referenced specification)', 'Specification-specific'),
 ('RULE-012', 'OTHER', 'Locator to be captured (DLP clause of the individual contract)', 'Contract-specific'),
 ('WRD-AA-001', 'URL_FRAGMENT', 'contentid=4067', 'WRD decision-process page; WRD-specific'),
 ('DEMO-AUTH-AA', 'OTHER', 'Synthetic demo matrix - not a government source', NULL),
 ('DEMO-AUTH-TS', 'OTHER', 'Synthetic demo matrix - not a government source', NULL),
 ('DEMO-AUTH-DTP', 'OTHER', 'Synthetic demo matrix - not a government source', NULL),
 ('DEMO-AUTH-COMPLETION', 'OTHER', 'Synthetic demo matrix - not a government source', NULL)
) AS c(rule_code, ctype, locator, notes)
JOIN rule_versions rv ON rv.rule_code = c.rule_code AND rv.version_no = 1
WHERE NOT EXISTS (
    SELECT 1 FROM rule_citations x WHERE x.rule_version_id = rv.id AND x.locator = c.locator
);
