import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAs, makeTestApp } from '../helpers/app.js';
import { type Api, type Refs, api, createAndSubmit, loadRefs } from '../helpers/flow.js';
import { dispatchPending } from '../../src/modules/notifications/notifications.service.js';
import { tickOverdue } from '../../src/modules/tasks/tasks.jobs.js';

let app: FastifyInstance;
let a: Api;
let refs: Refs;
const tok: Record<string, string> = {};
let pid = '';

beforeAll(async () => {
  app = await makeTestApp();
  a = api(app);
  for (const p of ['officer', 'monitor', 'admin', 'approver', 'se']) tok[p] = await loginAs(app, p);
  refs = await loadRefs(a, tok.admin!);
  pid = await createAndSubmit(a, tok.officer!, refs, 'Blocked-site scenario test');
  // finish PROPOSAL so SITE_HANDOVER and BUDGET_PROVISION become eligible
  const tasks = (await a.get('/tasks/mine', tok.officer!)).body.data as any[];
  const t = tasks.find((x) => x.projectId === pid && x.title.includes('Project proposal'));
  expect((await a.post(`/tasks/${t.id}/complete`, tok.officer!)).status).toBe(200);
  // simulate: site handover has been pending for 8 days against a configured 3-day SLA
  await app.db.query(
    `update workflow_node_instances n set eligible_at = now() - interval '8 days', due_at = now() - interval '5 days'
       from workflow_instances wi where wi.id = n.workflow_instance_id and wi.project_id = $1 and n.node_code = 'SITE_HANDOVER'`,
    [pid],
  );
  await app.db.query(`update tasks set due_at = now() - interval '5 days' where project_id = $1 and title like 'Site readiness%'`, [pid]);
});
afterAll(async () => {
  await app.close();
});

describe('root blocker analysis on a real generated graph', () => {
  it('SITE_HANDOVER is the root blocker: 8 days old vs 3-day configured SLA, blocking 7 downstream steps', async () => {
    const res = await a.get(`/projects/${pid}/blockers`, tok.monitor!);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const b = res.body.data;
    expect(b.blockers).toHaveLength(1);
    const top = b.blockers[0];
    expect(top).toMatchObject({
      nodeCode: 'SITE_HANDOVER', reason: 'SLA_OVERDUE', ageDays: 8, overdueDays: 5, slaDays: 3, overdue: true, downstreamCount: 7,
      gateKind: 'RULE_BACKED', mandatoryGate: true,
    });
    expect(top.downstream.map((d: any) => d.nodeCode)).toEqual([
      'CONSTRUCTION_START', 'EXEC_FOUNDATION', 'EXEC_SUPERSTRUCTURE', 'EXEC_FINISHING', 'COMPLETION', 'HANDOVER', 'DLP',
    ]);
    expect(top.downstream.map((d: any) => d.depth)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(top.rule).toMatchObject({ ruleCode: 'RULE-007', trustBadge: 'VERIFIED_SOURCE' });
    expect(top.owner.designation).toBe('Department Officer');
    expect(top.owner.holderName).toContain('Department Officer');
    expect(top.message).toBe(
      'Current root blocker candidate: Site readiness and land made over. It is preventing 7 downstream steps from becoming ready. This step is a mandatory gate under a verified rule.',
    );
    expect(top.unblockCondition).toContain('Provide the required documents');
    expect(b.headline).toBe(top.message);
  });

  it('the on-schedule branch is listed as frontier and parallel-eligible, not as a blocker', async () => {
    const b = (await a.get(`/projects/${pid}/blockers`, tok.monitor!)).body.data;
    const front = Object.fromEntries(b.frontier.map((f: any) => [f.nodeCode, f]));
    expect(front.BUDGET_PROVISION).toMatchObject({ overdue: false });
    expect(front.SITE_HANDOVER).toMatchObject({ overdue: true, downstreamCount: 7 });
    expect(b.parallelEligible.map((p: any) => p.nodeCode).sort()).toEqual(['BUDGET_PROVISION', 'SITE_HANDOVER']);
  });

  it('a project with no problems has no blockers', async () => {
    const clean = await createAndSubmit(a, tok.officer!, refs, 'On-schedule scenario test');
    const b = (await a.get(`/projects/${clean}/blockers`, tok.monitor!)).body.data;
    expect(b.blockers).toEqual([]);
    expect(b.headline).toBeNull();
    expect(b.frontier.length).toBeGreaterThan(0);
  });
});

describe('control-tower dashboards', () => {
  it('attention lists the blocked project with its root blocker', async () => {
    const r = await a.get('/dashboard/attention?limit=10', tok.monitor!);
    expect(r.status).toBe(200);
    const mine = r.body.data.find((x: any) => x.project.id === pid);
    expect(mine).toBeTruthy();
    expect(mine.blocker).toMatchObject({ nodeCode: 'SITE_HANDOVER', downstreamCount: 7 });
    expect(mine.project.code).toMatch(/^INF-/);
  });

  it('summary aggregates scoped counts deterministically', async () => {
    const s = (await a.get('/dashboard/summary', tok.monitor!)).body.data;
    expect(s.projects.active).toBeGreaterThanOrEqual(2);
    expect(Number(s.projects.totalValue)).toBeGreaterThanOrEqual(240000000);
    expect(s.blockedDownstream).toBeGreaterThanOrEqual(7);
    expect(s.tasks.overdue).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(s.approvals.byType)).toBe(true);
  });

  it('SLA watch lists the overdue step with owner and days over', async () => {
    const r = (await a.get('/dashboard/overdue', tok.monitor!)).body.data as any[];
    const item = r.find((x) => x.projectId === pid && x.nodeCode === 'SITE_HANDOVER');
    expect(item).toMatchObject({ overdueDays: 5, ageDays: 8, slaDays: 3, ownerDesignation: 'Department Officer' });
  });

  it('dashboards are permission-gated', async () => {
    expect((await a.get('/dashboard/summary', tok.officer!)).status).toBe(200);
    const contractor = await loginAs(app, 'contractor');
    expect((await a.get('/dashboard/summary', contractor)).status).toBe(403);
  });
});

describe('overdue ticker and outbox dispatcher', () => {
  it('ticker marks the overdue task once and flags the project AT_RISK', async () => {
    const first = await tickOverdue(app.db);
    expect(first.marked).toBeGreaterThanOrEqual(1);
    const second = await tickOverdue(app.db);
    expect(second.marked).toBe(0);
    const t = await app.db.query(`select status from tasks where project_id=$1 and title like 'Site readiness%'`, [pid]);
    expect(t.rows[0].status).toBe('OVERDUE');
    const proj = (await a.get(`/projects/${pid}`, tok.officer!)).body.data;
    expect(proj.operationalStatus).toBe('AT_RISK');
  });

  it('dispatcher fans events out to the right people and marks every event published', async () => {
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const r = await dispatchPending(app.db, 200);
      total += r.processed;
      if (r.processed === 0) break;
    }
    expect(total).toBeGreaterThan(0);
    const unpublished = await app.db.query(`select count(*)::int c from domain_events where published_at is null`);
    expect(unpublished.rows[0].c).toBe(0);

    const officer = (await a.get('/notifications', tok.officer!)).body.data;
    const titles: string[] = officer.items.map((n: any) => n.title);
    expect(titles.some((t) => t.startsWith('New task: Site readiness'))).toBe(true);
    expect(titles).toContain('Workflow generated');
    expect(titles.some((t) => t.startsWith('Overdue against configured SLA'))).toBe(true);
    expect(officer.unread).toBeGreaterThan(0);

    const monitor = (await a.get('/notifications', tok.monitor!)).body.data;
    expect(monitor.items.some((n: any) => n.type === 'TASK_OVERDUE')).toBe(true);
    expect(monitor.items.some((n: any) => n.type === 'TASK_ASSIGNED')).toBe(false);
  });

  it('marking notifications read updates the unread count', async () => {
    const before = (await a.get('/notifications', tok.officer!)).body.data;
    const one = before.items.find((n: any) => !n.read);
    expect((await a.post(`/notifications/${one.id}/read`, tok.officer!)).status).toBe(200);
    const mid = (await a.get('/notifications', tok.officer!)).body.data;
    expect(mid.unread).toBe(before.unread - 1);
    await a.post('/notifications/read-all', tok.officer!);
    expect((await a.get('/notifications', tok.officer!)).body.data.unread).toBe(0);
    expect((await a.post('/notifications/00000000-0000-0000-0000-000000000000/read', tok.officer!)).status).toBe(404);
  });

  it('a second dispatch run is a no-op (events are published exactly once)', async () => {
    const r = await dispatchPending(app.db, 200);
    expect(r).toEqual({ processed: 0, created: 0 });
  });
});
