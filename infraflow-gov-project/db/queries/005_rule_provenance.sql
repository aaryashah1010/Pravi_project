-- Show the source chain behind a rule.
SELECT
    rv.rule_code,
    rv.version_no,
    rv.rule_name,
    rv.verification_status,
    rv.enforcement_mode,
    rs.source_code,
    rs.title AS source_title,
    rs.issuing_authority,
    rs.source_type,
    rs.verification_level,
    rs.document_number,
    rs.effective_from AS source_effective_from,
    rs.effective_to AS source_effective_to,
    rc.citation_type,
    rc.locator,
    rc.page_start,
    rc.page_end
FROM rule_versions rv
JOIN rule_sources rs ON rs.id = rv.source_id
LEFT JOIN rule_citations rc ON rc.rule_version_id = rv.id
WHERE rv.id = $1
ORDER BY rc.created_at;
