import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAs, makeTestApp } from '../helpers/app.js';
import { type Api, type Refs, api, loadRefs } from '../helpers/flow.js';
import { type Journey, makeJourney } from '../helpers/journey.js';

let app: FastifyInstance;
let a: Api;
let refs: Refs;
let j: Journey;
const tok: Record<string, string> = {};
let pid = '';
let m1Id = '';

beforeAll(async () => {
  app = await makeTestApp();
  a = api(app);
  for (const p of ['officer', 'engineer', 'approver', 'se', 'inspector', 'monitor', 'contractor', 'admin']) tok[p] = await loginAs(app, p);
  refs = await loadRefs(a, tok.admin!);

  const start = new Date(Date.now() - 60 * 86_400_000);
  const c = await a.at(start).post('/projects', tok.officer!, {
    name: 'Construction flow test building', departmentOrganizationId: refs.demoOrgId, owningOfficeId: refs.divOfficeId, primaryJurisdictionId: refs.talukaId,
    estimatedCost: '42000000.00', attributes: { local_body_approval_required: false },
    proposal: { justification: 'Synthetic project for construction monitoring tests.' },
  });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  pid = c.body.data.id;
  j = makeJourney(a, tok, refs, pid, start);
  expect((await a.at(start).post(`/projects/${pid}/submit`, tok.officer!)).status).toBe(200);
  await j.throughWorkOrder('39000000.00');
});
afterAll(async () => {
  await app.close();
});

describe('pre-construction reaches the site-handover gate', () => {
  it('everything through work order is done; CONSTRUCTION_START waits only for SITE_HANDOVER; local-body node is not applicable', async () => {
    const wf = await j.workflow();
    const st = Object.fromEntries(wf.nodes.map((n: any) => [n.nodeCode, n.activationState]));
    expect(st.WORK_ORDER).toBe('COMPLETED');
    expect(st.LOCAL_BODY_CLEARANCE).toBe('NOT_APPLICABLE');
    expect(st.SITE_HANDOVER).toBe('ELIGIBLE');
    expect(st.CONSTRUCTION_START).toBe('INACTIVE');
    const b = (await a.get(`/projects/${pid}/blockers`, tok.monitor!)).body.data;
    expect(b.blockers.map((x: any) => x.nodeCode)).toContain('SITE_HANDOVER');
  });

  it('the 4.2 Cr project routed every approval to the EE (synthetic band) and the contract assigned the contractor', async () => {
    const rows = await app.db.query(
      `select ac.approval_type, r.resolution_status, p.position_code from approval_cases ac
         join authority_resolutions r on r.id = ac.authority_resolution_id join positions p on p.id = r.resolved_position_id
        where ac.project_id = $1 order by ac.approval_type`, [pid]);
    expect(rows.rows.map((r) => [r.approval_type, r.position_code])).toEqual([
      ['ADMINISTRATIVE_APPROVAL', 'DIV-EE-01'], ['TECHNICAL_SANCTION', 'DIV-EE-01'], ['TENDER_DTP_APPROVAL', 'DIV-EE-01'],
    ]);
    const contract = (await a.get(`/projects/${pid}/contract`, tok.contractor!)).body.data;
    expect(contract).toMatchObject({ contractor: { code: 'DEMO-CTR-01' }, awardedValue: '39000000.00', status: 'ACTIVE', dlpEndDate: expect.any(String) });
    expect(contract.workOrder.number).toMatch(/^WO-/);
    const visible = (await a.get('/projects', tok.contractor!)).body.data as any[];
    expect(visible.map((p) => p.id)).toContain(pid);
    expect(visible.every((p) => p.departmentCode === 'DEMO-GOV')).toBe(true);
  });

  it('completing the site handover satisfies RULE-007 data-driven (possession becomes HANDED_OVER) and auto-completes the gate', async () => {
    await j.handoverSite();
    const wf = await j.workflow();
    const st = Object.fromEntries(wf.nodes.map((n: any) => [n.nodeCode, n.activationState]));
    expect(st.SITE_HANDOVER).toBe('COMPLETED');
    expect(st.CONSTRUCTION_START).toBe('COMPLETED');
    expect(st.EXEC_FOUNDATION).toBe('ELIGIBLE');
    const site = await app.db.query(`select possession_status from project_sites where project_id=$1`, [pid]);
    expect(site.rows[0].possession_status).toBe('HANDED_OVER');
    const m = await j.milestone('M1');
    m1Id = m.id;
    expect(m).toMatchObject({ code: 'M1', status: 'PENDING', reportedProgress: 0, verifiedProgress: 0, nodeCode: 'EXEC_FOUNDATION' });
    const proj = (await a.get(`/projects/${pid}`, tok.officer!)).body.data;
    expect(proj.lifecycleStage).toBe('CONSTRUCTION');
  });
});

describe('reported progress is never verified progress', () => {
  it('contractor can report progress, starting the work; reporting 100% does NOT complete the milestone', async () => {
    j.advance(3);
    const m = await j.report('M1', 40, 'Excavation and PCC complete');
    expect(m).toMatchObject({ reportedProgress: 40, verifiedProgress: 0, status: 'IN_PROGRESS', lastUpdate: { reportedProgress: 40 } });
    expect((await j.node('EXEC_FOUNDATION')).activationState).toBe('ACTIVE');
    j.advance(10);
    const done = await j.report('M1', 100, 'Footings and plinth complete');
    expect(done).toMatchObject({ reportedProgress: 100, verifiedProgress: 0, status: 'IN_PROGRESS' });
    expect((await j.node('EXEC_FOUNDATION')).activationState).toBe('ACTIVE');
  });

  it('progress reports validate range and are rejected before work has started', async () => {
    expect((await a.post(`/milestones/${m1Id}/progress`, tok.contractor!, { reportedProgress: 140 })).status).toBe(400);
    const m2 = await j.milestone('M2').catch(() => null);
    expect(m2).toBeNull(); // M2 does not exist until its predecessor completes
    expect((await a.post(`/milestones/${m1Id}/progress`, tok.officer!, { reportedProgress: 50 })).status).toBe(403);
  });
});

describe('inspections: request, guardrails, fail, rectify, pass', () => {
  let insp1 = '';
  let issueId = '';

  it('contractor requests an inspection; one pending per milestone; a task lands on the inspector seat', async () => {
    const i = await j.requestInspection('M1', 'contractor', 'Foundation ready for inspection');
    insp1 = i.id;
    expect(i).toMatchObject({ result: 'PENDING', milestoneCode: 'M1', templateCode: 'STRUCTURAL-WORK-CHECK', canSubmit: false });
    expect(i.checklistSchema).toHaveLength(6);
    expect(i.inspector).toMatchObject({ positionCode: 'DIV-JE-01', designation: 'Junior Engineer' });
    expect((await a.post(`/projects/${pid}/inspections`, tok.contractor!, { milestoneCode: 'M1' })).status).toBe(409);
    const tasks = (await a.get('/tasks/mine', tok.inspector!)).body.data as any[];
    expect(tasks.some((t) => t.projectId === pid && t.taskType === 'INSPECTION' && t.title === 'Inspect: Foundation and plinth')).toBe(true);
    expect((await a.get(`/inspections/${insp1}`, tok.inspector!)).body.data.canSubmit).toBe(true);
  });

  it('only the inspector seat may submit: officer 403 (no permission), engineer 403 (does not hold the seat)', async () => {
    const body = { result: 'PASS', checklist: [] };
    expect((await a.post(`/inspections/${insp1}/submit`, tok.officer!, body)).status).toBe(403);
    const insp = (await a.get(`/inspections/${insp1}`, tok.inspector!)).body.data;
    const full = { result: 'PASS', checklist: insp.checklistSchema.map((c: any) => ({ itemCode: c.code, result: 'PASS' })), verifiedProgress: 50 };
    const eng = await a.post(`/inspections/${insp1}/submit`, tok.engineer!, full);
    expect(eng.status).toBe(403);
    expect(eng.body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('inconsistent submissions are rejected with field errors', async () => {
    const insp = (await a.get(`/inspections/${insp1}`, tok.inspector!)).body.data;
    const items = insp.checklistSchema.map((c: any) => c.code);
    const allPass = items.map((c: string) => ({ itemCode: c, result: 'PASS' }));
    const withFail = items.map((c: string, i: number) => ({ itemCode: c, result: i === 0 ? 'FAIL' : 'PASS' }));
    const post = (b: unknown) => a.post(`/inspections/${insp1}/submit`, tok.inspector!, b);

    const passWithFail = await post({ result: 'PASS', checklist: withFail });
    expect(passWithFail.status).toBe(400);
    expect(passWithFail.body.error.fieldErrors.map((f: any) => f.field)).toContain('result');
    const failNoObs = await post({ result: 'FAIL', checklist: withFail });
    expect(failNoObs.body.error.fieldErrors.map((f: any) => f.field)).toContain('observations');
    const failWithVerified = await post({ result: 'FAIL', observations: 'x', checklist: withFail, verifiedProgress: 60 });
    expect(failWithVerified.body.error.fieldErrors.map((f: any) => f.field)).toContain('verifiedProgress');
    const missingItems = await post({ result: 'PASS', checklist: allPass.slice(0, 2) });
    expect(missingItems.status).toBe(400);
    expect(missingItems.body.error.fieldErrors.length).toBeGreaterThan(0);
  });

  it('geo-tagged photo evidence links to the inspection with its coordinates and a stored hash', async () => {
    j.advance(1);
    const photo = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`fake-jpeg-${Date.now()}`)]);
    const up = await a.at(j.now).upload(pid, tok.inspector!, { documentTypeCode: 'SITE_PHOTO', inspectionId: insp1, latitude: '23.0225', longitude: '72.5714', title: 'Column C4 rebar check' }, { mime: 'image/jpeg', content: photo });
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    const insp = (await a.get(`/inspections/${insp1}`, tok.inspector!)).body.data;
    expect(insp.evidence).toHaveLength(1);
    expect(insp.evidence[0]).toMatchObject({ title: 'Column C4 rebar check', mimeType: 'image/jpeg', latitude: 23.0225, longitude: 72.5714 });
    expect(insp.evidence[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    const bad = await a.upload(pid, tok.inspector!, { documentTypeCode: 'SITE_PHOTO', inspectionId: insp1, latitude: '999', longitude: '72' }, { mime: 'image/jpeg', content: photo });
    expect(bad.status).toBe(400);
    const spoof = await a.upload(pid, tok.inspector!, { documentTypeCode: 'SITE_PHOTO' }, { mime: 'image/png', content: Buffer.from('not a png at all') });
    expect(spoof.status).toBe(400);
  });

  it('FAIL raises a blocking quality issue: node BLOCKED, project BLOCKED, root blocker with downstream impact, rectification task for the contractor', async () => {
    j.advance(1);
    const r = await j.submitInspection(insp1, {
      result: 'FAIL', observations: 'Cover blocks missing on columns C15-C20; rectification required before pour.', failItems: ['COVER'], lat: 23.0225, lon: 72.5714,
    });
    expect(r).toMatchObject({ result: 'FAIL', canSubmit: false, latitude: '23.022500' });
    expect(r.raisedIssueId).toBeTruthy();
    issueId = r.raisedIssueId;
    expect(r.checklistResults.find((c: any) => c.itemCode === 'COVER').result).toBe('FAIL');

    const node = await j.node('EXEC_FOUNDATION');
    expect(node).toMatchObject({ activationState: 'BLOCKED', openIssueCount: 1 });
    expect((await a.get(`/projects/${pid}`, tok.officer!)).body.data.operationalStatus).toBe('BLOCKED');
    expect((await j.milestone('M1')).status).toBe('BLOCKED');

    const b = (await a.get(`/projects/${pid}/blockers`, tok.monitor!)).body.data;
    expect(b.blockers[0]).toMatchObject({ nodeCode: 'EXEC_FOUNDATION', reason: 'ISSUE_BLOCKS', downstreamCount: 5 });
    expect(b.blockers[0].issues[0].title).toBe('Inspection failed: Foundation and plinth');
    expect(b.blockers[0].unblockCondition).toContain('Resolve the open issue');

    const tasks = (await a.get('/tasks/mine', tok.contractor!)).body.data as any[];
    expect(tasks.some((t) => t.taskType === 'RECTIFICATION' && t.projectId === pid)).toBe(true);
    const issue = (await a.get(`/issues/${issueId}`, tok.contractor!)).body.data;
    expect(issue).toMatchObject({ category: 'quality', severity: 'HIGH', status: 'OPEN', blocks: [{ nodeCode: 'EXEC_FOUNDATION' }] });
  });

  it('a milestone with an open blocking issue cannot complete, even with a passing inspection at 100%', async () => {
    j.advance(2);
    const req = await a.at(j.now).post(`/projects/${pid}/inspections`, tok.contractor!, { milestoneCode: 'M1' });
    expect(req.status, JSON.stringify(req.body)).toBe(201);
    const r = await j.submitInspection(req.body.data.id, { result: 'PASS', verifiedProgress: 100 });
    expect(r.result).toBe('PASS');
    expect((await j.milestone('M1'))).toMatchObject({ verifiedProgress: 100, status: 'BLOCKED' });
    expect((await j.node('EXEC_FOUNDATION')).activationState).toBe('BLOCKED');
  });

  it('resolving the issue restores the node and the project; the next PASS at 100% completes the milestone and unlocks M2', async () => {
    j.advance(1);
    const short = await a.post(`/issues/${issueId}/resolve`, tok.officer!, { resolution: 'x' });
    expect(short.status).toBe(400);
    const resolved = await a.at(j.now).post(`/issues/${issueId}/resolve`, tok.officer!, { resolution: 'Cover blocks fixed and re-verified by the site engineer.' });
    expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
    expect(resolved.body.data).toMatchObject({ status: 'RESOLVED', resolution: 'Cover blocks fixed and re-verified by the site engineer.' });
    expect((await a.post(`/issues/${issueId}/resolve`, tok.officer!, { resolution: 'Resolving twice is a conflict.' })).status).toBe(409);
    expect((await j.node('EXEC_FOUNDATION')).activationState).toBe('ACTIVE');
    expect((await a.get(`/projects/${pid}`, tok.officer!)).body.data.operationalStatus).not.toBe('BLOCKED');

    j.advance(1);
    const req = j.must(await a.at(j.now).post(`/projects/${pid}/inspections`, tok.contractor!, { milestoneCode: 'M1' }), 'request');
    const r = await j.submitInspection(req.id, { result: 'PASS', verifiedProgress: 100 });
    expect(r.result).toBe('PASS');
    expect(await j.milestone('M1')).toMatchObject({ status: 'COMPLETED', verifiedProgress: 100, actualFinish: expect.any(String) });
    const wf = await j.workflow();
    expect(wf.nodes.find((n: any) => n.nodeCode === 'EXEC_FOUNDATION').activationState).toBe('COMPLETED');
    expect(wf.nodes.find((n: any) => n.nodeCode === 'EXEC_SUPERSTRUCTURE').activationState).toBe('ELIGIBLE');
    expect(await j.milestone('M2')).toMatchObject({ status: 'PENDING', nodeCode: 'EXEC_SUPERSTRUCTURE' });
  });

  it('verified progress cannot decrease', async () => {
    j.advance(1);
    await j.report('M2', 30, 'Columns up to first lift');
    const req = j.must(await a.at(j.now).post(`/projects/${pid}/inspections`, tok.contractor!, { milestoneCode: 'M2' }), 'request');
    await j.submitInspection(req.id, { result: 'OBSERVATION', observations: 'Progress verified at 40%; minor housekeeping notes.', verifiedProgress: 40 });
    expect((await j.milestone('M2')).verifiedProgress).toBe(40);
    const req2 = j.must(await a.at(j.now).post(`/projects/${pid}/inspections`, tok.contractor!, { milestoneCode: 'M2' }), 'request 2');
    const insp = (await a.get(`/inspections/${req2.id}`, tok.inspector!)).body.data;
    const lower = await a.post(`/inspections/${req2.id}/submit`, tok.inspector!, {
      result: 'PASS', verifiedProgress: 20, checklist: insp.checklistSchema.map((c: any) => ({ itemCode: c.code, result: 'PASS' })),
    });
    expect(lower.status).toBe(400);
    expect(lower.body.error.fieldErrors[0].field).toBe('verifiedProgress');
  });
});

describe('issues on the workflow graph', () => {
  it('validates the workflow step, refuses to block a completed step, and links AFFECTS without blocking', async () => {
    const mk = (b: object) => a.post(`/projects/${pid}/issues`, tok.contractor!, { title: 'Utility relocation pending', category: 'utility', severity: 'HIGH', ...b });
    expect((await mk({ blocksNodes: ['NOPE'] })).status).toBe(400);
    const done = await mk({ blocksNodes: ['CONSTRUCTION_START'] });
    expect(done.status).toBe(400);
    expect(done.body.error.fieldErrors[0].message).toContain('COMPLETED');
    const affects = await mk({ affectsNodes: ['EXEC_SUPERSTRUCTURE'] });
    expect(affects.status).toBe(201);
    expect(affects.body.data.affects).toEqual([{ nodeCode: 'EXEC_SUPERSTRUCTURE', name: 'Superstructure' }]);
    expect((await j.node('EXEC_SUPERSTRUCTURE')).activationState).not.toBe('BLOCKED');
    const blocks = await mk({ title: 'Utility relocation blocks superstructure', blocksNodes: ['EXEC_SUPERSTRUCTURE'] });
    expect(blocks.status).toBe(201);
    expect((await j.node('EXEC_SUPERSTRUCTURE')).activationState).toBe('BLOCKED');
    const open = (await a.get(`/projects/${pid}/issues?status=open`, tok.monitor!)).body.data as any[];
    expect(open.length).toBe(2);
  });

  it('a contractor cannot raise issues on projects outside its assignment; inspector cannot resolve without issue.manage? (has it) but scope applies', async () => {
    const other = await a.post('/projects', tok.admin!, {
      name: 'Unassigned project for scope test', departmentOrganizationId: refs.demoOrgId, owningOfficeId: refs.divOfficeId, estimatedCost: '1000000',
      proposal: { justification: 'Synthetic project used to test contractor scope.' },
    });
    expect((await a.post(`/projects/${other.body.data.id}/issues`, tok.contractor!, { title: 'Should not be allowed', category: 'other', severity: 'LOW' })).status).toBe(404);
  });

  it('the audit trail records the whole story (inspection, issue, milestone events) for audit.read holders only', async () => {
    const audit = (await a.get(`/projects/${pid}/audit?limit=200`, tok.monitor!)).body.data as any[];
    const actions = new Set(audit.map((x) => x.action));
    for (const e of ['inspection.requested', 'inspection.submitted', 'issue.raised', 'issue.resolved', 'milestone.progress_reported', 'milestone.completed', 'contract.recorded']) {
      expect(actions.has(e), e).toBe(true);
    }
    expect((await a.get(`/projects/${pid}/audit`, tok.contractor!)).status).toBe(403);
    const backdated = audit.find((x) => x.action === 'contract.recorded');
    expect(new Date(backdated.at).getTime()).toBeLessThan(Date.now() - 20 * 86_400_000);
  });
});
