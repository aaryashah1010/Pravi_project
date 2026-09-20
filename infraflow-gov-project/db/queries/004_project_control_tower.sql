-- One row per active project with the most useful control-tower signals.
WITH open_tasks AS (
    SELECT project_id, COUNT(*) AS open_task_count
    FROM tasks
    WHERE status IN ('PENDING','IN_PROGRESS','OVERDUE','BLOCKED')
    GROUP BY project_id
),
open_issues AS (
    SELECT project_id, COUNT(*) AS open_issue_count
    FROM issues
    WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED')
    GROUP BY project_id
),
open_approvals AS (
    SELECT project_id, COUNT(*) AS open_approval_count
    FROM approval_cases
    WHERE status IN ('PENDING','IN_REVIEW','RETURNED')
    GROUP BY project_id
)
SELECT
    p.id,
    p.project_code,
    p.name,
    p.lifecycle_stage,
    p.operational_status,
    p.estimated_cost,
    COALESCE(t.open_task_count, 0) AS open_task_count,
    COALESCE(i.open_issue_count, 0) AS open_issue_count,
    COALESCE(a.open_approval_count, 0) AS open_approval_count
FROM projects p
LEFT JOIN open_tasks t ON t.project_id = p.id
LEFT JOIN open_issues i ON i.project_id = p.id
LEFT JOIN open_approvals a ON a.project_id = p.id
WHERE p.operational_status NOT IN ('CLOSED','CANCELLED');
