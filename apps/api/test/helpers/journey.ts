import type { Api, Refs } from './flow.js';

const DAY = 86_400_000;
const PERSONA_FOR_SEAT: Record<string, string> = { 'DIV-EE-01': 'approver', 'DIST-SE-01': 'se' };

/**
 * Drives a project through the REAL API on a controllable clock (x-demo-now). Shared by tests and the demo scenario seeder,
 * so seeded history is produced by the same engine paths the UI uses (audit, transitions, outbox and all).
 */
export function makeJourney(base: Api, tok: Record<string, string>, refs: Refs, pid: string, start: Date, pace = 1) {
  let now = start;
  const A = () => base.at(now);
  const must = (r: { status: number; body: any }, what: string) => {
    if (r.status < 200 || r.status >= 300) throw new Error(`${what} failed: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.data;
  };
  /** Move the clock forward; `pace` < 1 compresses the whole story into a shorter real-time window. */
  const advance = (days: number, hours = 0) => {
    now = new Date(now.getTime() + (days * DAY + hours * 3_600_000) * pace);
    return now;
  };
  const setTime = (d: Date) => {
    if (d.getTime() < now.getTime()) throw new Error(`clock cannot go backwards (${d.toISOString()} < ${now.toISOString()})`);
    now = d;
    return now;
  };

  const workflow = async () => must(await A().get(`/projects/${pid}/workflow`, tok.admin!), 'workflow');
  const node = async (code: string) => (await workflow()).nodes.find((n: any) => n.nodeCode === code);

  async function uploadMissing(who: string, nodeCode: string) {
    const n = await node(nodeCode);
    for (const d of n.requiredDocuments.filter((x: any) => x.status === 'MISSING' || x.status === 'REJECTED')) {
      must(await A().upload(pid, tok[who]!, { documentTypeCode: d.documentTypeCode, nodeCode }), `upload ${d.documentTypeCode}`);
    }
  }

  async function completeTask(who: string, titleIncludes: string) {
    const tasks = must(await A().get('/tasks/mine', tok[who]!), 'tasks') as any[];
    const t = tasks.find((x) => x.projectId === pid && x.taskType === 'WORK_ITEM' && x.title.includes(titleIncludes));
    if (!t) throw new Error(`no open work item "${titleIncludes}" for ${who}`);
    return must(await A().post(`/tasks/${t.id}/complete`, tok[who]!), `complete "${titleIncludes}"`);
  }

  async function approvalFor(nodeCode: string) {
    const list = must(await A().get(`/approvals?projectId=${pid}`, tok.admin!), 'approvals') as any[];
    const ap = list.find((x) => x.nodeCode === nodeCode);
    if (!ap) throw new Error(`no approval for ${nodeCode}`);
    return ap;
  }

  async function runApproval(nodeCode: string, submitter: string, opts: { returnOnce?: boolean } = {}) {
    let ap = await approvalFor(nodeCode);
    await uploadMissing(submitter, nodeCode);
    must(await A().post(`/approvals/${ap.id}/submit`, tok[submitter]!), `submit ${nodeCode}`);
    const decider = PERSONA_FOR_SEAT[ap.authority.position?.code];
    if (!decider) throw new Error(`no persona for seat ${ap.authority.position?.code}`);
    if (opts.returnOnce) {
      advance(1);
      must(await A().post(`/approvals/${ap.id}/return`, tok[decider]!, { reason: 'Please correct the supporting documents and resubmit.' }), `return ${nodeCode}`);
      advance(1);
      must(await A().post(`/approvals/${ap.id}/submit`, tok[submitter]!), `resubmit ${nodeCode}`);
    }
    advance(1);
    ap = must(await A().post(`/approvals/${ap.id}/approve`, tok[decider]!), `approve ${nodeCode}`);
    return { decider, approval: ap };
  }

  async function recordContract(awardedValue: string, extra: Record<string, unknown> = {}) {
    const d = (o: number) => new Date(now.getTime() + o * DAY).toISOString().slice(0, 10);
    return must(
      await A().put(`/projects/${pid}/contract`, tok.officer!, {
        contractorCode: 'DEMO-CTR-01', contractNumber: `CT-${pid.slice(0, 6).toUpperCase()}`, awardedValue, contractDate: d(0), startDate: d(5),
        completionDate: d(365), dlpMonths: 12, workOrderNumber: `WO-${pid.slice(0, 6).toUpperCase()}`, ...extra,
      }),
      'record contract',
    );
  }

  /** proposal -> budget -> AA -> design -> TS -> funds -> DTP -> tender -> contract -> work order. Site handover NOT included. */
  async function throughWorkOrder(awardedValue: string) {
    advance(1); await completeTask('officer', 'Project proposal');
    advance(1); await uploadMissing('officer', 'BUDGET_PROVISION'); await completeTask('officer', 'Budget provision');
    advance(2); await runApproval('ADMIN_APPROVAL', 'officer');
    advance(4); await uploadMissing('engineer', 'DESIGN_ESTIMATE'); await completeTask('engineer', 'Detailed design');
    advance(3); await runApproval('TECHNICAL_SANCTION', 'engineer');
    advance(1); await completeTask('officer', 'Fund allotment');
    advance(2); await runApproval('TENDER_DTP_APPROVAL', 'officer');
    advance(10); await completeTask('officer', 'Tender / procurement');
    advance(6); await recordContract(awardedValue); await completeTask('officer', 'Contract award');
    advance(3); await completeTask('approver', 'Work order');
  }

  async function handoverSite() {
    await uploadMissing('officer', 'SITE_HANDOVER');
    await completeTask('officer', 'Site readiness');
  }

  async function milestone(code: string) {
    const list = must(await A().get(`/projects/${pid}/milestones`, tok.admin!), 'milestones') as any[];
    const m = list.find((x) => x.code === code);
    if (!m) throw new Error(`no milestone ${code}`);
    return m;
  }

  async function report(code: string, pct: number, narrative: string, who = 'contractor') {
    const m = await milestone(code);
    return must(await A().post(`/milestones/${m.id}/progress`, tok[who]!, { reportedProgress: pct, narrative }), `report ${code}`);
  }

  async function requestInspection(code: string, who = 'contractor', note?: string) {
    return must(await A().post(`/projects/${pid}/inspections`, tok[who]!, { milestoneCode: code, ...(note ? { note } : {}) }), `request inspection ${code}`);
  }

  async function submitInspection(
    id: string,
    o: { result: 'PASS' | 'FAIL' | 'OBSERVATION'; verifiedProgress?: number; observations?: string; failItems?: string[]; lat?: number; lon?: number; who?: string },
  ) {
    const insp = must(await A().get(`/inspections/${id}`, tok[o.who ?? 'inspector']!), 'inspection');
    const checklist = insp.checklistSchema.map((c: any) => ({ itemCode: c.code, result: o.failItems?.includes(c.code) ? 'FAIL' : 'PASS' }));
    return must(
      await A().post(`/inspections/${id}/submit`, tok[o.who ?? 'inspector']!, {
        result: o.result, checklist, ...(o.observations ? { observations: o.observations } : {}),
        ...(o.verifiedProgress !== undefined ? { verifiedProgress: o.verifiedProgress } : {}),
        ...(o.lat !== undefined ? { latitude: o.lat, longitude: o.lon } : {}),
      }),
      'submit inspection',
    );
  }

  return {
    pid, tok, refs,
    get now() { return now; },
    advance, setTime, api: A, must, workflow, node, uploadMissing, completeTask, approvalFor, runApproval, recordContract,
    throughWorkOrder, handoverSite, milestone, report, requestInspection, submitInspection,
  };
}

export type Journey = ReturnType<typeof makeJourney>;
