// Demo scenario seeder. Drives the REAL API in-process on a backdated clock (x-demo-now, enabled only here),
// so every seeded project has a genuine audit trail, workflow transitions, approvals and outbox events.
// Usage: npm run seed:scenarios   (run after db:reset; skips if DEMO-INF-0001 already exists; --force to add anyway)
import './lib/env.js';
import { buildApp } from '../apps/api/src/app.js';
import { loadActor, findUserByEmail } from '../apps/api/src/modules/auth/auth.repo.js';
import { createProject } from '../apps/api/src/modules/projects/projects.service.js';
import { actorContext } from '../apps/api/src/platform/context.js';
import { dispatchPending } from '../apps/api/src/modules/notifications/notifications.service.js';
import { tickOverdue } from '../apps/api/src/modules/tasks/tasks.jobs.js';
import { api, loadRefs, type Refs } from '../apps/api/test/helpers/flow.js';
import { makeJourney } from '../apps/api/test/helpers/journey.js';

const DAY = 86_400_000;
const T = Date.now();
const ago = (days: number) => new Date(T - days * DAY);
const PERSONAS = ['officer', 'engineer', 'approver', 'se', 'inspector', 'monitor', 'contractor', 'admin'] as const;

const { app } = await buildApp({ allowDemoClock: true, runBackgroundJobs: false, logLevel: 'silent' });
const a = api(app);
const log = (m: string) => console.log(`  ${m}`);

async function main() {
  const exists = await app.db.query(`SELECT 1 FROM projects WHERE project_code = 'DEMO-INF-0001'`);
  if (exists.rowCount && !process.argv.includes('--force')) {
    console.log('Demo scenarios already present (use --force to add again). Nothing to do.');
    return;
  }

  const tok: Record<string, string> = {};
  for (const p of PERSONAS) {
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: `${p}@demo.infraflow.local`, password: process.env.DEMO_PASSWORD ?? 'Demo@12345' } });
    if (r.statusCode !== 200) throw new Error(`login ${p} failed: ${r.body}`);
    tok[p] = r.json().data.token;
  }
  const refs: Refs = await loadRefs(a, tok.admin!);

  async function create(who: 'officer' | 'admin', code: string, at: Date, input: Record<string, unknown>) {
    const user = (await findUserByEmail(app.db, `${who}@demo.infraflow.local`))!;
    const actor = (await loadActor(app.db, user.id, new Date()))!; // current authority; only the business clock is backdated
    const p = await createProject(app.db, actorContext(actor, at), input as never, { projectCode: code });
    return p.id;
  }
  const school = (over: Record<string, unknown>) => ({
    projectTypeCode: 'GOV_BUILDING', departmentOrganizationId: refs.demoOrgId, owningOfficeId: refs.divOfficeId, primaryJurisdictionId: refs.talukaId,
    fundingSourceCode: 'STATE_BUDGET', site: { district: 'Demo Ahmedabad District', taluka: 'Demo Taluka 01', city: 'Demo City', possessionStatus: 'PENDING' }, ...over,
  });

  // ---- DEMO-INF-0001: fresh project, not yet submitted (used LIVE in the demo) ---------------------------------
  await create('officer', 'DEMO-INF-0001', ago(1), school({
    name: 'Demo Government School Building', estimatedCost: '120000000.00', attributes: {},
    proposal: { justification: 'New 48-classroom government school building to replace unsafe temporary structures (synthetic demo project).' },
  }));
  log('DEMO-INF-0001  fresh 12 Cr school (unsubmitted; AA will route to the SE, TS to the EE)');

  // ---- DEMO-INF-0003: pre-construction, site handover pending 8 days vs 3-day configured SLA ----------------------
  {
    const start = new Date(T - 8.25 * DAY);
    const pid = await create('officer', 'DEMO-INF-0003', start, school({
      name: 'Demo District Health Centre', estimatedCost: '42000000.00', attributes: { local_body_approval_required: false },
      proposal: { justification: 'Primary health centre with an outpatient block and diagnostics wing (synthetic demo project).' },
    }));
    expect((await a.at(start).post(`/projects/${pid}/submit`, tok.officer!)).status).toBe(200);
    const j = makeJourney(a, tok, refs, pid, start, 0.24);
    await j.throughWorkOrder('39000000.00');
    log('DEMO-INF-0003  4.2 Cr health centre: everything through work order done; SITE_HANDOVER pending -> blocks construction start');
  }

  // ---- DEMO-INF-0002: construction at risk (utility issue + failed inspection + pending re-inspection) ----------
  {
    const start = ago(62);
    const pid = await create('officer', 'DEMO-INF-0002', start, school({
      name: 'Demo Higher Secondary School Block B', estimatedCost: '85000000.00', attributes: { local_body_approval_required: false },
      proposal: { justification: 'Two-storey classroom block with laboratories (synthetic demo project).' },
    }));
    expect((await a.at(start).post(`/projects/${pid}/submit`, tok.officer!)).status).toBe(200);
    const j = makeJourney(a, tok, refs, pid, start, 0.7);
    await j.throughWorkOrder('79500000.00');
    j.advance(1);
    await j.handoverSite();

    // plan both milestones (planned vs verified drives the variance shown in the UI)
    const m1 = await j.milestone('M1');
    j.must(await a.at(j.now).post(`/milestones/${m1.id}/plan`, tok.engineer!, { plannedStart: ago(34).toISOString().slice(0, 10), plannedFinish: ago(22).toISOString().slice(0, 10), plannedProgress: 100 }), 'plan M1');

    j.setTime(ago(33)); await j.report('M1', 45, 'Excavation, PCC and footing reinforcement in progress');
    j.setTime(ago(26)); await j.report('M1', 100, 'Footings and plinth beams complete, ready for inspection');
    j.setTime(ago(25));
    const i1 = await j.requestInspection('M1', 'contractor', 'Foundation and plinth ready for inspection');
    j.setTime(ago(24));
    await j.submitInspection(i1.id, { result: 'PASS', verifiedProgress: 100, lat: 23.0225, lon: 72.5714 });

    const m2 = await j.milestone('M2');
    j.must(await a.at(j.now).post(`/milestones/${m2.id}/plan`, tok.engineer!, { plannedStart: ago(22).toISOString().slice(0, 10), plannedFinish: new Date(T + 25 * DAY).toISOString().slice(0, 10), plannedProgress: 58 }), 'plan M2');
    j.setTime(ago(16)); await j.report('M2', 35, 'Columns and beams up to first floor level');
    j.setTime(ago(12));
    const i2 = await j.requestInspection('M2', 'contractor', 'First-lift columns ready');
    j.setTime(ago(11));
    await j.submitInspection(i2.id, { result: 'OBSERVATION', verifiedProgress: 42, observations: 'Verified progress is 42% against 58% planned; curing records to be maintained.' });

    j.setTime(ago(9));
    j.must(await a.at(j.now).post(`/projects/${pid}/issues`, tok.contractor!, {
      title: 'HT cable relocation pending', description: 'A utility cable crossing the east perimeter must be relocated before the next lift.', category: 'utility', severity: 'HIGH',
      blocksNodes: ['EXEC_SUPERSTRUCTURE'],
    }), 'raise utility issue');
    j.setTime(ago(7)); await j.report('M2', 65, 'Casting continued on unaffected bays; east perimeter work halted');
    j.setTime(ago(6));
    const i3 = await j.requestInspection('M2', 'contractor', 'Bays C1-C14 ready');
    j.setTime(ago(5));
    await j.submitInspection(i3.id, { result: 'FAIL', observations: 'Cover blocks missing on columns C15-C20; rectification required before pour.', failItems: ['COVER'], lat: 23.0228, lon: 72.5711 });
    j.setTime(ago(1));
    await j.requestInspection('M2', 'contractor', 'Re-inspection after rectification of C15-C20');
    log('DEMO-INF-0002  8.5 Cr school block: foundation done; superstructure 65% reported vs 42% verified; 2 blocking issues; re-inspection PENDING (submit it live as the inspector)');
  }

  // ---- DEMO-INF-0004: real R&B department, no verified delegation => manual review ---------------------------------
  {
    const start = ago(3);
    const pid = await create('admin', 'DEMO-INF-0004', start, {
      projectTypeCode: 'GOV_BUILDING', departmentOrganizationId: refs.rnbOrgId, owningOfficeId: refs.rnbOfficeId, estimatedCost: '40000000.00',
      name: 'R&B Division Office Building (delegation not configured)', attributes: {},
      proposal: { justification: 'Prototype project to show that an unverified delegation is never guessed (synthetic demo project).' },
    });
    expect((await a.at(start).post(`/projects/${pid}/submit`, tok.admin!)).status).toBe(200);
    const j = makeJourney(a, tok, refs, pid, start, 0.2);
    j.advance(1); await j.completeTask('admin', 'Project proposal');
    j.advance(1); await j.uploadMissing('admin', 'BUDGET_PROVISION'); await j.completeTask('admin', 'Budget provision');
    log('DEMO-INF-0004  R&B 4 Cr: Administrative Approval -> AUTHORITY NOT RESOLVED (manual review)');
  }

  // ---- housekeeping: SLA ticker, deliver notifications, then mark the seeded ones read ------------------------------
  const ticked = await tickOverdue(app.db);
  for (let i = 0; i < 50; i++) if ((await dispatchPending(app.db, 500)).processed === 0) break;
  await app.db.query(`UPDATE notification_recipients SET read_at = now() WHERE read_at IS NULL`);
  log(`SLA ticker marked ${ticked.marked} overdue task(s); notifications delivered and marked read (live demo actions will appear as new)`);
}

function expect(v: unknown) {
  return { toBe: (x: unknown) => { if (v !== x) throw new Error(`expected ${String(x)}, got ${String(v)}`); } };
}

console.log('Seeding demo scenarios...');
try {
  await main();
  console.log('Done.');
} catch (e) {
  console.error('Scenario seeding failed:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await app.close();
}
