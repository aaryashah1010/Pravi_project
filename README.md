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

## 🔑 Demo Credentials

The login screen features **One-click Persona Buttons** on the right side. You do not need to type passwords to switch roles during the demo—just click the persona you want to impersonate!

If you prefer to log in manually, the password for *every* synthetic demo account is:
> `Demo@12345`

### Available Demo Personas
* **Division Officer** (`officer@demo.infraflow.local`): The initiator. Creates projects, submits documents, and completes early tasks.
* **Executive Engineer** (`ee@demo.infraflow.local`): Mid-level authority. Reviews and forwards approvals.
* **Chief Engineer** (`ce@demo.infraflow.local`): Top-level authority. Approves high-budget sanctions.
* **Site Inspector** (`inspector@demo.infraflow.local`): On-the-ground reality check. Reports verified progress and raises blocking issues.

---

## 🧪 Recommended Demo Flow

To see the true power of InfraFlow, we recommend walking through this exact scenario:

1. **Rule Evaluation:** Log in as **Division Officer**. Create a New Project and set the Estimated Value to **6,00,00,000 (6 Crores)**. 
2. **Dynamic Generation:** Click "Generate Workflow". Show the visual **Workflow Tab**. Explain how the system dynamically decided the *Chief Engineer* must approve the Technical Sanction based on the budget rule.
3. **Authority Routing:** Log out, and log in as the **Chief Engineer**. Check your **Approvals Inbox**. Approve the request and check the immutable **Audit Log**.
4. **Blockers & Cascading Delays:** Log out, and log in as the **Site Inspector**. Open project `DEMO-INF-0002` (which is pre-seeded as blocked). Go to the **Issues** tab and raise a critical blocker. Show how the visual workflow graph instantly cascades the delay downstream.
5. **AI with Guardrails:** Open the **Copilot Tab** on the blocked project. Ask: *"Why is this project blocked?"* Watch the AI correctly diagnose the bottleneck and cite the exact rule code as proof.

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
