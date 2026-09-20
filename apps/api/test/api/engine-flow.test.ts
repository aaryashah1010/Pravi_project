import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAs, makeTestApp } from '../helpers/app.js';
import { type Api, type Refs, api, loadRefs } from '../helpers/flow.js';

let app: FastifyInstance;
let a: Api;
let refs: Refs;
const tok: Record<string, string> = {};

const node = (wf: any, code: string) => wf.nodes.find((n: any) => n.nodeCode === code);
const wfOf = async (pid: string, who = 'officer') => (await a.get(`/projects/${pid}/workflow`, tok[who]!)).body.data;

async function upload(pid: string, who: string, docType: string, nodeCode: string) {
  const r = await a.upload(pid, tok[who]!, { documentTypeCode: docType, nodeCode });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
}

async function completeTaskFor(pid: string, who: string, titleIncludes: string) {
  const tasks = (await a.get('/tasks/mine', tok[who]!)).body.data as any[];
  const t = tasks.find((x) => x.projectId === pid && x.title.includes(titleIncludes) && x.taskType === 'WORK_ITEM');
  expect(t, `task "${titleIncludes}" for ${who}`).toBeTruthy();
  const r = await a.post(`/tasks/${t.id}/complete`, tok[who]!);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}

async function approvalFor(pid: string, nodeCode: string, who = 'admin') {
  const list = (await a.get(`/approvals?projectId=${pid}`, tok[who]!)).body.data as any[];
  return list.find((x) => x.nodeCode === nodeCode);
}

beforeAll(async () => {
  app = await makeTestApp();
  a = api(app);
  for (const p of ['officer', 'engineer', 'approver', 'se', 'inspector', 'monitor', 'admin', 'contractor']) tok[p] = await loginAs(app, p);
  refs = await loadRefs(a, tok.admin!);
});
afterAll(async () => {
  await app.close();
});

describe('project -> rules -> workflow -> authority -> approvals (synthetic DEMO-GOV, 12 Cr)', () => {
  let pid = '';

  it('officer creates a project; nothing is generated until it is submitted', async () => {
    const res = await a.post('/projects', tok.officer!, {
      name: 'Engine flow test school',
      departmentOrganizationId: refs.demoOrgId,
      owningOfficeId: refs.divOfficeId,
      primaryJurisdictionId: refs.talukaId,
      estimatedCost: '120000000.00',
      site: { district: 'Demo Ahmedabad', taluka: 'Demo Taluka 01', possessionStatus: 'PENDING' },
      proposal: { justification: 'New government school building to replace an unsafe structure.' },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    pid = res.body.data.id;
    expect(res.body.data.code).toMatch(/^INF-\d{4}-\d{5}$/);
    expect(res.body.data.hasWorkflow).toBe(false);
    expect(res.body.data.isDemo).toBe(true);
    expect((await a.get(`/projects/${pid}/workflow`, tok.officer!)).status).toBe(404);
  });

  it('submit generates a 19-node graph: conditional node pending (never silently N/A), first node eligible, rule evaluations recorded', async () => {
    const res = await a.post(`/projects/${pid}/submit`, tok.officer!);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.hasWorkflow).toBe(true);

    const wf = await wfOf(pid);
    expect(wf.nodes).toHaveLength(19);
    expect(wf.summary).toMatchObject({ total: 19, pendingVerification: 1, notApplicable: 0, eligible: 1 });
    expect(node(wf, 'PROPOSAL').activationState).toBe('ELIGIBLE');
    expect(node(wf, 'PROPOSAL').gateKind).toBe('RULE_BACKED');
    expect(node(wf, 'LOCAL_BODY_CLEARANCE')).toMatchObject({ gateKind: 'CONDITIONAL_PENDING', activationState: 'INACTIVE' });
    expect(node(wf, 'LOCAL_BODY_CLEARANCE').conditionPending.facts).toEqual(['attributes.local_body_approval_required']);
    expect(node(wf, 'WORK_ORDER').gateKind).toBe('CONFIGURED');
    expect(node(wf, 'TENDER').gateKind).toBe('ADVISORY');
    expect(node(wf, 'ADMIN_APPROVAL').rule).toMatchObject({ ruleCode: 'RNB-WF-002', trustBadge: 'VERIFIED_SOURCE' });
    expect(node(wf, 'ADMIN_APPROVAL').activationState).toBe('INACTIVE');
    expect(wf.edges).toHaveLength(22);
    expect(wf.edges.find((e: any) => e.from === 'LOCAL_BODY_CLEARANCE' && e.to === 'CONTRACT')).toMatchObject({ dependencyType: 'CONDITIONAL', state: 'ACTIVE' });

    const ev = await app.db.query(`select count(*)::int c, count(*) filter (where result='INDETERMINATE')::int i from rule_evaluations where project_id=$1`, [pid]);
    expect(ev.rows[0]).toEqual({ c: 16, i: 1 });
    const frozen = await app.db.query(`select context_snapshot->>'templateCode' t, jsonb_array_length(context_snapshot->'ruleVersions') n from workflow_instances where project_id=$1`, [pid]);
    expect(frozen.rows[0]).toEqual({ t: 'GOV_BUILDING_STD', n: 12 });
  });

  it('tasks are assigned to seats; the officer sees the work item and the verification task', async () => {
    const tasks = (await a.get('/tasks/mine', tok.officer!)).body.data as any[];
    const mine = tasks.filter((t) => t.projectId === pid);
    expect(mine.map((t) => t.taskType).sort()).toEqual(['CONDITION_VERIFICATION', 'WORK_ITEM']);
    expect(mine.every((t) => t.viaSeat && t.assignedPosition.code === 'DIST-OFFICER-01')).toBe(true);
    const engineerTasks = (await a.get('/tasks/mine', tok.engineer!)).body.data as any[];
    expect(engineerTasks.filter((t) => t.projectId === pid)).toHaveLength(0);
  });

  it('a work item with missing required documents cannot be completed (400), and succeeds once the document is uploaded', async () => {
    await completeTaskFor(pid, 'officer', 'Project proposal');
    const wf = await wfOf(pid);
    expect(node(wf, 'PROPOSAL').activationState).toBe('COMPLETED');
    expect(node(wf, 'BUDGET_PROVISION').activationState).toBe('ELIGIBLE');
    expect(node(wf, 'SITE_HANDOVER').activationState).toBe('ELIGIBLE');

    const tasks = (await a.get('/tasks/mine', tok.officer!)).body.data as any[];
    const budget = tasks.find((t) => t.projectId === pid && t.title.includes('Budget provision'));
    const denied = await a.post(`/tasks/${budget.id}/complete`, tok.officer!);
    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe('VALIDATION_ERROR');
    expect(denied.body.error.fieldErrors[0].field).toBe('BUDGET_PROVISION');

    await upload(pid, 'officer', 'BUDGET_PROVISION', 'BUDGET_PROVISION');
    await completeTaskFor(pid, 'officer', 'Budget provision');
  });

  it('12 Cr Administrative Approval routes to the SE seat from the SYNTHETIC matrix, with provenance and an amber synthetic badge', async () => {
    const wf = await wfOf(pid);
    expect(node(wf, 'ADMIN_APPROVAL').activationState).toBe('ELIGIBLE');
    const ap = await approvalFor(pid, 'ADMIN_APPROVAL');
    expect(ap.status).toBe('PENDING');
    expect(ap.authority).toMatchObject({ resolutionStatus: 'RESOLVED', requiresManualReview: false, synthetic: true, ruleCode: 'DEMO-AA-HIGH' });
    expect(ap.authority.position).toMatchObject({ code: 'DIST-SE-01', designation: 'Superintending Engineer' });
    expect(ap.authority.position.holder.displayName).toContain('Superintending Engineer');
    expect(ap.authority.rule.trustBadge).toBe('SYNTHETIC_DEMO');
    expect(ap.nodeRule).toMatchObject({ ruleCode: 'RNB-WF-002', trustBadge: 'VERIFIED_SOURCE' });
    const snap = await app.db.query(`select resolution_snapshot s from authority_resolutions where project_id=$1 and approval_type='ADMINISTRATIVE_APPROVAL'`, [pid]);
    expect(snap.rows[0].s.considered.map((c: any) => [c.code, c.excluded])).toEqual([['DEMO-AA-HIGH', null]]);
  });

  it('cannot submit while a required document is missing; submits after upload', async () => {
    const ap = await approvalFor(pid, 'ADMIN_APPROVAL');
    const denied = await a.post(`/approvals/${ap.id}/submit`, tok.officer!);
    expect(denied.status).toBe(400);
    expect(denied.body.error.fieldErrors[0].field).toBe('DPR');
    await upload(pid, 'officer', 'DPR', 'ADMIN_APPROVAL');
    const ok = await a.post(`/approvals/${ap.id}/submit`, tok.officer!);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.status).toBe('IN_REVIEW');
    const wf = await wfOf(pid);
    expect(node(wf, 'ADMIN_APPROVAL')).toMatchObject({ activationState: 'ACTIVE', executionState: 'IN_PROGRESS' });
  });

  it('only the current holder of the resolved position may decide: EE gets 403, officer gets 403, SE is allowed', async () => {
    const ap = await approvalFor(pid, 'ADMIN_APPROVAL');
    const ee = await a.post(`/approvals/${ap.id}/approve`, tok.approver!);
    expect(ee.status).toBe(403);
    expect(ee.body.error.code).toBe('INSUFFICIENT_SCOPE');
    const officer = await a.post(`/approvals/${ap.id}/approve`, tok.officer!);
    expect(officer.status).toBe(403);
    const view = (await a.get(`/approvals/${ap.id}`, tok.se!)).body.data;
    expect(view.canDecide).toBe(true);
    const eeView = (await a.get(`/approvals/${ap.id}`, tok.approver!)).body.data;
    expect(eeView.canDecide).toBe(false);
  });

  it('return/reject require a reason; a returned approval can be corrected and resubmitted', async () => {
    const ap = await approvalFor(pid, 'ADMIN_APPROVAL');
    const noReason = await a.post(`/approvals/${ap.id}/return`, tok.se!, {});
    expect(noReason.status).toBe(400);
    expect(noReason.body.error.fieldErrors[0].field).toBe('reason');
    const ret = await a.post(`/approvals/${ap.id}/return`, tok.se!, { reason: 'Project report needs the revised cost sheet.' });
    expect(ret.status, JSON.stringify(ret.body)).toBe(200);
    expect(ret.body.data.status).toBe('RETURNED');
    expect(ret.body.data.decisions.map((d: any) => d.action)).toEqual(['SUBMIT', 'RETURN']);
    const wf = await wfOf(pid);
    expect(node(wf, 'ADMIN_APPROVAL')).toMatchObject({ activationState: 'ELIGIBLE', executionState: 'RETURNED' });
    const resubmit = await a.post(`/approvals/${ap.id}/submit`, tok.officer!);
    expect(resubmit.status, JSON.stringify(resubmit.body)).toBe(200);
    expect(resubmit.body.data.status).toBe('IN_REVIEW');
  });

  it('two simultaneous approvals: exactly one wins, the other gets 409 STATE_CONFLICT; cascade unlocks design & estimate', async () => {
    const ap = await approvalFor(pid, 'ADMIN_APPROVAL');
    const [x, y] = await Promise.all([a.post(`/approvals/${ap.id}/approve`, tok.se!), a.post(`/approvals/${ap.id}/approve`, tok.se!)]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    const loser = x.status === 409 ? x : y;
    expect(loser.body.error.code).toBe('STATE_CONFLICT');

    const wf = await wfOf(pid);
    expect(node(wf, 'ADMIN_APPROVAL').activationState).toBe('COMPLETED');
    expect(node(wf, 'DESIGN_ESTIMATE').activationState).toBe('ELIGIBLE');
    expect(node(wf, 'DESIGN_ESTIMATE').assignedPosition.code).toBe('DIV-AE-01');
    const eng = (await a.get('/tasks/mine', tok.engineer!)).body.data as any[];
    expect(eng.some((t) => t.projectId === pid && t.title.includes('Detailed design'))).toBe(true);

    const sanction = await app.db.query(`select sanction_type, sanctioned_amount::text amt from sanctions where project_id=$1`, [pid]);
    expect(sanction.rows).toEqual([{ sanction_type: 'ADMINISTRATIVE_APPROVAL', amt: '120000000.00' }]);
    const decisions = await app.db.query(`select action from approval_decisions where approval_case_id=$1 order by created_at`, [ap.id]);
    expect(decisions.rows.map((r) => r.action)).toEqual(['SUBMIT', 'RETURN', 'SUBMIT', 'APPROVE']);
  });

  it('12 Cr Technical Sanction routes to the EE seat (different band, same engine); EE approves', async () => {
    await upload(pid, 'engineer', 'DRAWING', 'DESIGN_ESTIMATE');
    await upload(pid, 'engineer', 'ESTIMATE', 'DESIGN_ESTIMATE');
    await completeTaskFor(pid, 'engineer', 'Detailed design');
    const ap = await approvalFor(pid, 'TECHNICAL_SANCTION');
    expect(ap.authority).toMatchObject({ resolutionStatus: 'RESOLVED', ruleCode: 'DEMO-TS-LOW', synthetic: true });
    expect(ap.authority.position.code).toBe('DIV-EE-01');
    await upload(pid, 'engineer', 'TECHNICAL_NOTE', 'TECHNICAL_SANCTION');
    expect((await a.post(`/approvals/${ap.id}/submit`, tok.engineer!)).status).toBe(200);
    expect((await a.post(`/approvals/${ap.id}/approve`, tok.se!)).status).toBe(403);
    const ok = await a.post(`/approvals/${ap.id}/approve`, tok.approver!);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);

    const wf = await wfOf(pid);
    expect(node(wf, 'TECHNICAL_SANCTION').activationState).toBe('COMPLETED');
    expect(node(wf, 'FUND_ALLOTMENT').activationState).toBe('ELIGIBLE');
    expect(node(wf, 'TENDER_DTP_APPROVAL').activationState).toBe('ELIGIBLE');
    expect(node(wf, 'LOCAL_BODY_CLEARANCE').activationState).toBe('INACTIVE');
    expect(node(wf, 'CONSTRUCTION_START').activationState).toBe('INACTIVE');
    const dtp = await approvalFor(pid, 'TENDER_DTP_APPROVAL');
    expect(dtp.authority.position.code).toBe('DIST-SE-01');
  });

  it('recording the missing fact resolves the pending node; its conditional edge starts gating and its clearance work item appears', async () => {
    const proj = (await a.get(`/projects/${pid}`, tok.officer!)).body.data;
    const res = await a.patch(`/projects/${pid}`, tok.officer!, { versionNo: proj.versionNo, attributes: { local_body_approval_required: true } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const wf = await wfOf(pid);
    expect(node(wf, 'LOCAL_BODY_CLEARANCE')).toMatchObject({ activationState: 'ELIGIBLE', gateKind: 'RULE_BACKED', conditionPending: null });
    expect(wf.edges.find((e: any) => e.from === 'LOCAL_BODY_CLEARANCE' && e.to === 'CONTRACT')).toMatchObject({ dependencyType: 'BLOCKING', originalType: 'CONDITIONAL' });
    const cl = await app.db.query(`select status from clearances where project_id=$1`, [pid]);
    expect(cl.rows).toEqual([{ status: 'PENDING' }]);
    const stale = await a.patch(`/projects/${pid}`, tok.officer!, { versionNo: proj.versionNo, name: 'Stale edit should conflict' });
    expect(stale.status).toBe(409);
  });

  it('cost cannot be edited after submission (a sanctioned estimate changes only through a variation)', async () => {
    const proj = (await a.get(`/projects/${pid}`, tok.officer!)).body.data;
    const r = await a.patch(`/projects/${pid}`, tok.officer!, { versionNo: proj.versionNo, estimatedCost: '1.00' });
    expect(r.status).toBe(409);
  });

  it('every mutation left an audit row and an outbox event in the same transaction', async () => {
    const audit = await app.db.query(`select action, count(*)::int c from audit_logs where project_id=$1 group by action`, [pid]);
    const byAction = Object.fromEntries(audit.rows.map((r) => [r.action, r.c]));
    expect(byAction).toMatchObject({
      'project.created': 1, 'project.submitted': 1, 'workflow.generated': 1, 'approval.submitted': 3, 'approval.return': 1,
      'approval.approve': 2, 'document.uploaded': 5, 'task.completed': 3, 'workflow.condition_resolved': 1, 'project.updated': 1,
    });
    const ev = await app.db.query(`select event_type, count(*)::int c from domain_events where aggregate_id=$1 group by event_type`, [pid]);
    const byEvent = Object.fromEntries(ev.rows.map((r) => [r.event_type, r.c]));
    expect(byEvent).toMatchObject({ ProjectCreated: 1, ProjectSubmitted: 1, WorkflowGenerated: 1, ApprovalDecided: 3 });
    expect(byEvent.TaskAssigned).toBeGreaterThan(8);
    const trans = await app.db.query(
      `select count(*)::int c from workflow_transitions t join workflow_node_instances n on n.id=t.workflow_node_instance_id join workflow_instances wi on wi.id=n.workflow_instance_id where wi.project_id=$1`,
      [pid],
    );
    expect(trans.rows[0].c).toBeGreaterThan(30);
  });

  it('the project lifecycle stage follows the furthest active node and status stays ACTIVE', async () => {
    const proj = (await a.get(`/projects/${pid}`, tok.officer!)).body.data;
    expect(proj.lifecycleStage).toBe('PROCUREMENT');
    expect(proj.operationalStatus).toBe('ACTIVE');
  });
});

describe('honest engine: real R&B department has no verified delegation', () => {
  let pid = '';

  it('authority is NOT guessed: approval opens in manual-review state and cannot be submitted', async () => {
    const c = await a.post('/projects', tok.admin!, {
      name: 'R&B honesty test building', departmentOrganizationId: refs.rnbOrgId, owningOfficeId: refs.rnbOfficeId, estimatedCost: '40000000',
      proposal: { justification: 'Prototype project to show that an unverified delegation is never guessed.' },
    });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    pid = c.body.data.id;
    expect((await a.post(`/projects/${pid}/submit`, tok.admin!)).status).toBe(200);

    await completeTaskFor(pid, 'admin', 'Project proposal');
    await upload(pid, 'admin', 'BUDGET_PROVISION', 'BUDGET_PROVISION');
    await completeTaskFor(pid, 'admin', 'Budget provision');

    const ap = await approvalFor(pid, 'ADMIN_APPROVAL', 'admin');
    expect(ap.status).toBe('PENDING');
    expect(ap.authority).toMatchObject({ resolutionStatus: 'NO_RULE', requiresManualReview: true, position: null, rule: null });
    expect(ap.authority.message).toContain('No automatic assignment was made');
    expect(ap.canManualAssign).toBe(true);

    await upload(pid, 'admin', 'DPR', 'ADMIN_APPROVAL');
    const submit = await a.post(`/approvals/${ap.id}/submit`, tok.admin!);
    expect(submit.status).toBe(422);
    expect(submit.body.error.code).toBe('AUTHORITY_NOT_RESOLVED');

    const tasks = (await a.get('/tasks/mine', tok.admin!)).body.data as any[];
    expect(tasks.some((t) => t.projectId === pid && t.taskType === 'MANUAL_AUTHORITY_REVIEW')).toBe(true);
    const ev = await app.db.query(`select count(*)::int c from domain_events where aggregate_id=$1 and event_type='AuthorityUnresolved'`, [pid]);
    expect(ev.rows[0].c).toBe(1);
  });

  it('a human can manually assign a competent position (audited); a vacant seat still cannot receive a submission', async () => {
    const ap = await approvalFor(pid, 'ADMIN_APPROVAL', 'admin');
    const tooShort = await a.post(`/approvals/${ap.id}/manual-assign`, tok.admin!, { positionId: refs.positions['RNB-EE-01'], reason: 'short' });
    expect(tooShort.status).toBe(400);
    const denied = await a.post(`/approvals/${ap.id}/manual-assign`, tok.officer!, { positionId: refs.positions['RNB-EE-01'], reason: 'Officer must not be able to do this.' });
    expect(denied.status).toBe(403);

    const vacant = await a.post(`/approvals/${ap.id}/manual-assign`, tok.admin!, { positionId: refs.positions['RNB-EE-01'], reason: 'R&B Executive Engineer seat per the departmental order on file.' });
    expect(vacant.status, JSON.stringify(vacant.body)).toBe(200);
    expect(vacant.body.data.authority.resolutionStatus).toBe('MANUAL_REVIEW');
    expect(vacant.body.data.authority.position.code).toBe('RNB-EE-01');
    const submit = await a.post(`/approvals/${ap.id}/submit`, tok.admin!);
    expect(submit.status).toBe(422);
    expect(submit.body.error.message).toContain('no active holder');

    const audit = await app.db.query(`select metadata->>'reason' r from audit_logs where action='approval.manual_assigned' and project_id=$1`, [pid]);
    expect(audit.rows[0].r).toContain('departmental order');
  });
});

describe('scope: projects are invisible outside the actor\'s department', () => {
  it('SE (DEMO-GOV) cannot see the R&B project; contractor sees no projects; monitor (global) sees both', async () => {
    const seList = (await a.get('/projects', tok.se!)).body.data as any[];
    expect(seList.some((p) => p.departmentCode === 'GJ-RNB')).toBe(false);
    expect(seList.some((p) => p.departmentCode === 'DEMO-GOV')).toBe(true);
    expect(((await a.get('/projects', tok.contractor!)).body.data as any[]).length).toBe(0);
    const monitor = (await a.get('/projects', tok.monitor!)).body.data as any[];
    expect(new Set(monitor.map((p) => p.departmentCode))).toEqual(new Set(['DEMO-GOV', 'GJ-RNB']));
    const rnb = monitor.find((p) => p.departmentCode === 'GJ-RNB');
    expect((await a.get(`/projects/${rnb.id}`, tok.se!)).status).toBe(404);
  });
});
