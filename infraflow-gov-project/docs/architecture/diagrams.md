# Architecture Diagrams

## 1. High-level system

```text
             GOVERNMENT / STAFF / CONTRACTOR / PUBLIC
                              │
                              ▼
                     React Web / PWA
                              │
                              ▼
                         Node.js API
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
 Authentication          Workflow + Rules           AI Copilot
 RBAC/ABAC                Dependency Graph          Grounded RAG
      │                       │                       │
      └───────────────────────┼───────────────────────┘
                              ▼
                         PostgreSQL
                              │
                 ┌────────────┼───────────┐
                 ▼            ▼           ▼
               Redis       Object      pgvector
                           Storage
                              │
                              ▼
                     External integrations
```

## 2. Authority resolution

```text
Project Facts
     │
     ▼
Applicable Rule Versions
     │
     ▼
Authority Requirements
     │
     ├── Decision type
     ├── Department
     ├── Jurisdiction
     ├── Value/other conditions
     └── Effective date
     │
     ▼
Matching Position
     │
     ▼
Current Position Holder
     │
     ▼
Task Assignment
```

## 3. AI trust chain

```text
Official Documents
       ↓
Source Archive + Hash
       ↓
Verified Rule Registry
       ↓
Project State + Workflow Graph
       ↓
Retrieval / Structured Context
       ↓
AI Response
       ↓
Citation + Confidence + Human Review
```

## 4. Root blocker

```text
A ──→ B ──→ C
          
D ──→ E

B is blocked
↓
C cannot become ready
↓
B is a root blocker candidate
↓
Show owner + age + downstream impact
```
