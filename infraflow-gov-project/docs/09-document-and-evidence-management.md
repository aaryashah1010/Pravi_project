# 09 — Document and Evidence Management

## Goals

- store documents securely;
- preserve versions;
- associate documents with business objects;
- enforce access controls;
- maintain integrity metadata;
- make evidence auditable;
- support AI extraction without changing the source document.

## Document object

```text
Document
- id
- project_id
- document_type
- title
- version
- status
- storage_key
- sha256
- mime_type
- size_bytes
- uploaded_by
- uploaded_at
- source_system
- effective_date
- superseded_date
```

## Evidence link

A document can be evidence for multiple objects without being duplicated.

```text
EvidenceLink
- evidence_id
- target_type
- target_id
- purpose
```

Example targets:

- Approval
- Inspection
- Milestone
- Measurement
- Bill
- ChangeRequest
- Issue
- Handover

## Versioning

Approved records should be immutable.

New changes create a new version.

Example:

```text
Estimate v1 → Returned
Estimate v2 → Submitted
Estimate v2 → Approved
Estimate v3 → Proposed variation
```

## Source documents for rules

Keep source documents in a dedicated knowledge/source collection with:

- title;
- issuing authority;
- document number;
- date;
- effective date;
- source URL;
- hash;
- file archive location;
- relevant clauses/pages;
- verification status;
- supersession links.

## AI ingestion

Pipeline:

```text
Official document
    ↓
Acquire/archive
    ↓
Hash
    ↓
Parse/OCR only if necessary
    ↓
Segment by clause/section/page
    ↓
Index text + metadata
    ↓
Human verification
    ↓
Rule candidate
    ↓
Rule registry
```

A document should not become an executable rule merely because an LLM extracted a sentence from it.
