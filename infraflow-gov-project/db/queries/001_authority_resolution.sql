-- Resolve candidate authority rules for a project/decision.
-- IMPORTANT: this query returns candidates; application logic MUST reject ambiguity.
-- It never invents an authority when no active source-backed rule matches.

WITH candidate_rules AS (
    SELECT
        ar.*,
        CASE WHEN ar.department_organization_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN ar.project_type_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN ar.jurisdiction_type IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN ar.min_cost IS NOT NULL OR ar.max_cost IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN ar.conditions <> '{}'::jsonb THEN 1 ELSE 0 END AS specificity
    FROM authority_rules ar
    JOIN projects p ON p.id = $1
    WHERE ar.status = 'ACTIVE'
      AND ar.decision_type = $2
      AND (ar.department_organization_id IS NULL OR ar.department_organization_id = p.department_organization_id)
      AND (ar.project_type_id IS NULL OR ar.project_type_id = p.project_type_id)
      AND (ar.min_cost IS NULL OR p.estimated_cost >= ar.min_cost)
      AND (ar.max_cost IS NULL OR p.estimated_cost <= ar.max_cost)
      AND (ar.valid_from IS NULL OR ar.valid_from <= CURRENT_DATE)
      AND (ar.valid_to IS NULL OR ar.valid_to >= CURRENT_DATE)
)
SELECT *
FROM candidate_rules
ORDER BY specificity DESC, priority ASC, created_at DESC;

-- Resolve the current holder after selecting ONE unambiguous authority rule.
SELECT
    v.position_id,
    v.position_code,
    v.office_id,
    v.position_type_id,
    v.user_id,
    v.display_name,
    v.assignment_type
FROM v_current_position_holders v
WHERE v.position_type_id = $1
  AND ($2::uuid IS NULL OR v.office_id = $2)
ORDER BY CASE WHEN v.assignment_type = 'PRIMARY' THEN 0 ELSE 1 END, v.start_at DESC;
