import type { BlockerDto, BlockersDto, WorkflowDto, WorkflowNodeDto } from '@infraflow/shared';
import type { Queryable } from '../../platform/db.js';
import type { Actor } from '../../platform/context.js';
import { getWorkflow } from './workflow-view.js';
import { type BlockerNode, analyzeBlockers } from './domain/blockers.js';
import type { DepState } from './domain/readiness.js';

const DAY = 86_400_000;

interface IssueRow {
  id: string;
  title: string;
  severity: string;
  opened_at: Date;
  node_code: string;
}

async function blockingIssues(db: Queryable, projectId: string): Promise<IssueRow[]> {
  const r = await db.query<IssueRow>(
    `SELECT i.id, i.title, i.severity, i.opened_at, n.node_code
       FROM issues i
       JOIN issue_workflow_links iwl ON iwl.issue_id = i.id AND iwl.impact_type = 'BLOCKS'
       JOIN workflow_node_instances n ON n.id = iwl.workflow_node_instance_id
      WHERE i.project_id = $1 AND i.status IN ('OPEN','IN_PROGRESS','BLOCKED') ORDER BY i.opened_at`,
    [projectId],
  );
  return r.rows;
}

function unblockCondition(n: WorkflowNodeDto, issues: IssueRow[]): string {
  if (n.approval) {
    if (n.approval.requiresManualReview) return 'A verified competent authority could not be resolved. An authorized administrator must assign the deciding position.';
    const who = n.assignedPosition?.designation ?? 'the competent authority';
    if (n.approval.status === 'IN_REVIEW') return `Awaiting a decision by ${who}.`;
    if (n.approval.status === 'REJECTED') return 'The approval was rejected. Resolve the recorded reasons and reopen through an authorized process.';
    return 'Prepare the required documents and submit the approval.';
  }
  if (issues.length) return `Resolve the open issue: ${issues[0]!.title}.`;
  const missing = n.requiredDocuments.filter((d) => d.status === 'MISSING' || d.status === 'REJECTED');
  if (missing.length) return `Provide the required document${missing.length > 1 ? 's' : ''}: ${missing.map((d) => d.name).join(', ')}.`;
  return `Complete this step (${n.name}).`;
}

export function toBlockerNodes(wf: WorkflowDto, issues: IssueRow[]): { nodes: BlockerNode[]; deps: DepState[] } {
  const nodes: BlockerNode[] = wf.nodes.map((n) => {
    const count = issues.filter((i) => i.node_code === n.nodeCode).length || n.openIssueCount;
    return {
      code: n.nodeCode,
      activation: n.activationState,
      execution: n.executionState,
      conditionPending: n.conditionPending !== null,
      eligibleAt: n.eligibleAt ? new Date(n.eligibleAt) : null,
      dueAt: n.dueAt ? new Date(n.dueAt) : null,
      blockKind: n.activationState === 'BLOCKED' ? (n.executionState === 'REJECTED' ? 'REJECTED' : 'ISSUE') : null,
      blockingIssueCount: count,
    };
  });
  const deps: DepState[] = wf.edges.map((e) => ({ from: e.from, to: e.to, type: e.dependencyType, state: e.state }));
  return { nodes, deps };
}

/**
 * Root-blocker view for one project. Copy follows docs/product/ui-copy.md: describes the step, never blames a person, and only
 * calls something a "mandatory gate" when a verified executable rule backs it.
 */
export async function getProjectBlockers(db: Queryable, actor: Actor, projectId: string, now: Date, wfIn?: WorkflowDto): Promise<BlockersDto> {
  const wf = wfIn ?? (await getWorkflow(db, actor, projectId, now));
  const issues = await blockingIssues(db, projectId);
  const { nodes, deps } = toBlockerNodes(wf, issues);
  const analysis = analyzeBlockers(nodes, deps, now);
  const byCode = new Map(wf.nodes.map((n) => [n.nodeCode, n]));
  const projectCode = (await db.query<{ project_code: string }>(`SELECT project_code FROM projects WHERE id = $1`, [projectId])).rows[0]!.project_code;

  const blockers: BlockerDto[] = analysis.blockers.map((f) => {
    const n = byCode.get(f.code)!;
    const nodeIssues = issues.filter((i) => i.node_code === f.code);
    const downstream = f.downstream.map((d) => ({ nodeCode: d.code, name: byCode.get(d.code)!.name, depth: d.depth }));
    const mandatory = n.gateKind === 'RULE_BACKED';
    const count = downstream.length;
    const base = `Current root blocker candidate: ${n.name}. It is preventing ${count} downstream step${count === 1 ? '' : 's'} from becoming ready.`;
    return {
      nodeCode: n.nodeCode,
      nodeName: n.name,
      nodeType: n.nodeType,
      activationState: n.activationState,
      reason: f.reason!,
      gateKind: n.gateKind,
      mandatoryGate: mandatory,
      ageDays: f.ageDays,
      slaDays: n.slaDays,
      dueAt: n.dueAt,
      overdue: f.overdue,
      overdueDays: f.overdueDays,
      downstreamCount: count,
      downstream,
      owner: n.assignedPosition
        ? { positionCode: n.assignedPosition.code, designation: n.assignedPosition.designation, officeName: n.assignedPosition.officeName, holderName: n.assignedPosition.holder?.displayName ?? null }
        : null,
      issues: nodeIssues.map((i) => ({ id: i.id, title: i.title, severity: i.severity, openedAt: i.opened_at.toISOString(), ageDays: Math.floor((now.getTime() - i.opened_at.getTime()) / DAY) })),
      rule: n.rule,
      unblockCondition: unblockCondition(n, nodeIssues),
      message: mandatory ? `${base} This step is a mandatory gate under a verified rule.` : `${base} This is a configured prerequisite.`,
    };
  });

  return {
    projectId,
    projectCode,
    generatedAt: now.toISOString(),
    headline: blockers[0]?.message ?? null,
    blockers,
    frontier: analysis.frontier.map((f) => ({
      nodeCode: f.code,
      nodeName: byCode.get(f.code)!.name,
      activationState: f.activation,
      ageDays: f.ageDays,
      overdue: f.overdue,
      downstreamCount: f.downstream.length,
      ownerDesignation: byCode.get(f.code)!.assignedPosition?.designation ?? null,
    })),
    parallelEligible: analysis.parallelEligible.map((c) => ({
      nodeCode: c,
      name: byCode.get(c)!.name,
      ownerDesignation: byCode.get(c)!.assignedPosition?.designation ?? null,
    })),
  };
}
