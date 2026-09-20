# InfraFlow 🏗️

**A source-backed, rule-driven workflow engine for government infrastructure projects.**

InfraFlow solves the massive bureaucratic complexity of executing public works projects (like building hospitals, schools, and bridges). By extracting rigid business logic from code into an **Immutable Rule Registry**, evaluating dynamic **Directed Acyclic Graph (DAG)** workflows, and employing an **AI Copilot with hard guardrails**, InfraFlow ensures projects move faster, transparently, and exactly according to government policy.

---

## 🛑 The Problem

Managing government infrastructure today is a nightmare of opacity and delays:
1. **Hardcoded Bureaucracy:** Software platforms hardcode approval chains (`if budget > 5Cr route to X`). When government policy changes, the software breaks, requiring months of expensive vendor updates.
2. **People-Centric Routing:** Approvals are routed to individuals (e.g., "John Doe"). When John is transferred, projects stall.
3. **Linear Processing:** Rigid 50-step flowcharts force independent approvals (like Fire Clearance and Environmental Clearance) to happen sequentially instead of in parallel.
4. **AI Hallucinations:** Generic AI models hallucinate government policies, making them dangerous for real-world civic administration.

## 💡 Our Solution & Architecture

InfraFlow rethinks how government software is built:

* **The Immutable Rule Registry:** All authority matrices and business rules are stored as data, not code. If a policy changes, an admin updates the registry, and the system instantly adapts. No redeploys needed.
* **Dynamic DAG Workflows:** InfraFlow evaluates a project's properties against the rule registry to dynamically build a Directed Acyclic Graph (DAG). This calculates exactly what approvals can happen in parallel and what steps block others.
* **Position-Based Routing:** The system routes tasks to *Positions* (e.g., `POS-CHIEF-ENG`), not people. If a new Chief Engineer takes over tomorrow, they instantly inherit the inbox.
* **Ground-Truth AI Copilot:** Our AI doesn't guess. It reads the real-time workflow DAG, the issue logs, and the rule registry. When asked why a project is delayed, it cites the exact government rule and the specific downstream bottleneck as proof.
* **Advisory vs. Verified Progress:** Contractors report *advisory* progress. Only a site inspector's *verified* data officially advances construction milestones.

---

## 🚀 How to Run (Local Demo)

The project uses a standard Node + PostgreSQL stack.

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose

### Setup Instructions
1. **Start the database:**
   ```bash
   npm run db:up
   ```
2. **Seed the database:**
   This command resets the DB, runs migrations, and populates it with realistic demo scenarios (active projects, blocked projects, users, rules, and rulesets).
   ```bash
   npm run db:demo
   ```
3. **Start the development servers (API + Web UI):**
   ```bash
   npm run dev
   ```
4. **Access the UI:**
   Open your browser to [http://localhost:5173](http://localhost:5173)

---

## 🐳 Deploy with Docker (Postgres + API + nginx)

Only nginx is published; it serves the web app and proxies `/api` to the API container. On first start the API container applies the migrations and loads the synthetic demo accounts and demo projects (all idempotent, never a reset).

```bash
# 1. Create .env next to docker-compose.prod.yml
JWT_SECRET=<at least 32 random characters>      # required   e.g. openssl rand -hex 32
POSTGRES_PASSWORD=<choose one>                  # recommended
WEB_PORT=8088                                   # 80 on a real server
PUBLIC_URL=http://localhost:8088                # the URL users type
OPENAI_API_KEY=                                 # optional; empty = deterministic offline Copilot
SEED_DEMO=1                                     # 0 = do not create demo accounts/projects

# 2. Build and start (first start takes 1-2 minutes: migrations + demo history)
docker compose -f docker-compose.prod.yml up -d --build

# 3. Watch it come up, then open http://localhost:8088
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

Update after a code change: `docker compose -f docker-compose.prod.yml up -d --build`. Data (Postgres and uploaded evidence) lives in the `pgdata` and `uploads` volumes and survives rebuilds. Stop with `docker compose -f docker-compose.prod.yml down` (add `-v` only to wipe all data).

## 🔑 Demo Credentials

The login screen features **One-click Persona Buttons** on the right side. You do not need to type passwords to switch roles during the demo—just click the persona you want to impersonate!

If you prefer to log in manually, the password for *every* synthetic demo account is:
> `Demo@12345`

### Available Demo Personas
| Login (`@demo.infraflow.local`) | Role |
|---|---|
| `officer` | Division officer: creates and submits projects, completes early tasks |
| `engineer` | Assistant engineer: verifies documents, requests inspections, updates milestones |
| `approver` | Executive Engineer: decides approvals routed to the EE position |
| `se` | Superintending Engineer: decides approvals routed to the SE position (higher-value projects) |
| `inspector` | Junior engineer / site inspector: submits geo-tagged inspections, raises issues |
| `monitor` | Read-only monitoring across departments: dashboards, audit, Copilot |
| `contractor` | Contractor: reports progress (advisory only), uploads documents |
| `admin` | Administrator: manual authority assignment, vacant-seat tasks |

> The delegation matrix for the demo department is **synthetic** and labelled so in the UI. The real R&B department has no delegation configured, so its approvals correctly show *manual review required*.

---

## 🧪 Recommended Demo Flow

1. **Rule evaluation:** log in as `officer`, create a project with an estimated cost of **12 Cr** and leave "local-body approval required" as *Unknown*. Submit it. The graph appears with a *Conditional, pending verification* step instead of silently skipping it.
2. **Authority routing:** log in as `se`. The administrative approval routes to the **SE** (synthetic rule: above 5 Cr). Open the approval, check the rule provenance and the amber **SYNTHETIC DEMO** badge, then approve. Log in as `approver`: technical sanction routes to the **EE** (up to 15 Cr).
3. **Root blocker:** open `DEMO-INF-0003`. The Overview shows the root blocker (site handover waiting 8 days against a 3-day configured SLA) and how many steps it holds back. Click any step in the **Workflow** graph to trace upward to the root cause and downward to the impact.
4. **Field inspection:** log in as `inspector`, open `DEMO-INF-0002` → **Inspections** → *Inspect* on the pending item. Fill the checklist, capture location, attach a photo and submit. A FAIL raises a quality issue that blocks the milestone.
5. **AI with guardrails:** open the **Copilot** tab and ask *"Why is this project blocked?"*. The answer cites only rules from the registry, is labelled advisory, and works offline when no API key is set.
6. **Honesty path:** open `DEMO-INF-0004` (real R&B department): the approval shows *manual review required* because no verified delegation exists.

---

## 🔮 Future Roadmap (Beyond the Hackathon)

Given the 8-hour time constraint of this hackathon, we built the core architecture and the most critical "Vertical Slice" to prove the concept. If we had more time, here is what we would build next:

1. **Dedicated Contractor Portal:**
   Currently, the API supports external contractors, but we simulated their actions in the internal UI for the demo. We would build a separate, external-facing web app for contractors to bid on tenders, upload compliance documents, and report daily progress.
2. **Digital Measurement Books (M-Books) & Financial Ledgers:**
   While the database schema already contains tables for `bills` and `bill_items`, building a complex, line-by-line financial ledger and digital M-Book UI takes significant time. We would implement this to track micro-finances against exact site measurements.
3. **Complex Tender Bidding Module:**
   Currently, the workflow engine simulates a successful tender award to keep the demo moving into the construction phase. We would build out the full tender publishing, bidder matching, and L1/L2 selection algorithms.
4. **Offline Mobile App for Inspectors:**
   Site inspectors often work in remote areas without internet. We would build a React Native companion app that allows them to take GPS-tagged photos and fill out inspection checklists offline, syncing with the DAG workflow when they return to connectivity.
5. **GIS & Drone Integration:**
   Integrating map-based visualizations to view all active government projects across a state/district on a live dashboard.
