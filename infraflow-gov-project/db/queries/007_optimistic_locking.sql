-- Generic optimistic-lock update pattern. The application supplies the known version_no.
UPDATE projects
SET
    operational_status = $2,
    lifecycle_stage = $3,
    version_no = version_no + 1,
    updated_at = now()
WHERE id = $1
  AND version_no = $4
RETURNING *;

-- If zero rows are returned, report a concurrent update conflict instead of overwriting state.
