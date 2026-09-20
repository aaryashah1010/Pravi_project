-- Append an immutable audit event inside the same transaction as the state mutation.
INSERT INTO audit_logs (
    request_id, actor_user_id, actor_position_id, actor_role_code,
    action, entity_type, entity_id, project_id, old_data, new_data, metadata
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8, $9, $10, $11
);

-- Transactional outbox event. Publish asynchronously after commit.
INSERT INTO domain_events (
    aggregate_type, aggregate_id, event_type, event_version, payload
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING id;

-- Claim a small batch of unpublished events without double-processing.
WITH claim AS (
    SELECT id
    FROM domain_events
    WHERE published_at IS NULL
    ORDER BY occurred_at
    FOR UPDATE SKIP LOCKED
    LIMIT $1
)
SELECT de.*
FROM domain_events de
JOIN claim c ON c.id = de.id;
