import type { BlockerDto } from '@infraflow/shared';
import type { AiContext, AiProvider, AiRawAnswer, AiRequest } from '../ai.types.js';

const BADGE_LABEL: Record<string, string> = {
  VERIFIED_SOURCE: 'verified source', CONDITIONAL: 'conditional requirement', CONTRACT_SPECIFIC: 'contract-specific', CURRENCY_CHECK_REQUIRED: 'currency check required',
  ADVISORY_ONLY: 'advisory only', NOT_VERIFIED: 'not verified', SUPERSEDED: 'superseded', SYNTHETIC_DEMO: 'SYNTHETIC DEMO placeholder, not a real rule',
};
const REASON_TEXT: Record<string, string> = {
  ISSUE_BLOCKS: 'an open issue is blocking it', APPROVAL_REJECTED: 'its approval was rejected', SLA_OVERDUE: 'it is past its configured SLA',
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

type Out = AiRawAnswer;
const ruleLine = (ctx: AiContext, code: string): string => {
  const r = ctx.rules.find((x) => x.ruleCode === code);
  if (!r) return `${code} (not found in the verified registry context)`;
  return `${r.ruleCode} - ${r.statement ?? r.name} [${BADGE_LABEL[r.trustBadge] ?? r.trustBadge}; source: ${r.sourceTitle}; citation: ${r.citations[0] ?? 'locator to be captured'}]`;
};
const sourcesFor = (ctx: AiContext, codes: string[]) => [...new Set(codes.map((c) => ctx.rules.find((r) => r.ruleCode === c)?.sourceCode).filter((x): x is string => !!x))];
const noWorkflow = (ctx: AiContext): Out => ({
  answer: `${ctx.project.code} has not been submitted yet, so no workflow, approvals or blockers exist. Submit the proposal to generate the workflow from the configured template and verified rules.`,
  factsUsed: [`project ${ctx.project.code} stage ${ctx.project.stage}`], rulesUsed: [], sources: [], confidence: 'high',
  suggestions: [{ type: 'NEXT_ACTION', title: 'Submit the project proposal', rationale: 'The workflow is generated only when the proposal is submitted.' }],
});

function explainBlocker(ctx: AiContext): Out {
  if (!ctx.nodes.length) return noWorkflow(ctx);
  const top: BlockerDto | undefined = ctx.blockers[0];
  if (!top) {
    const live = ctx.nodes.filter((n) => ['ELIGIBLE', 'ACTIVE'].includes(n.state));
    return {
      answer: `No root blocker is currently flagged for ${ctx.project.code}. ${plural(live.length, 'step')} ${live.length === 1 ? 'is' : 'are'} in progress on schedule${live.length ? `: ${live.map((n) => n.name).join(', ')}` : ''}.` +
        (ctx.workflowSummary.pendingVerification ? ` ${plural(ctx.workflowSummary.pendingVerification, 'conditional step')} still need a project fact to be recorded (manual verification required).` : ''),
      factsUsed: live.map((n) => `${n.code}: ${n.state}${n.ageDays != null ? `, ${n.ageDays}d` : ''}${n.slaDays != null ? ` of ${n.slaDays}d SLA` : ''}`), rulesUsed: [], sources: [], confidence: 'high', suggestions: [],
    };
  }
  const ruleCodes = top.rule ? [top.rule.ruleCode] : [];
  const parts = [
    top.message,
    `Why it is flagged: ${REASON_TEXT[top.reason] ?? top.reason}. It has been waiting ${top.ageDays} day${top.ageDays === 1 ? '' : 's'}${top.slaDays != null ? ` against a configured SLA of ${top.slaDays} day${top.slaDays === 1 ? '' : 's'}` : ''}${top.overdue ? ` (${top.overdueDays} day${top.overdueDays === 1 ? '' : 's'} over)` : ''}.`,
    `Held back (${top.downstreamCount}): ${top.downstream.map((d) => d.name).join(', ')}.`,
    top.owner ? `Responsible position: ${top.owner.designation}, ${top.owner.officeName}${top.owner.holderName ? ` (currently ${top.owner.holderName})` : ' (seat currently vacant)'}.` : '',
    top.issues.length ? `Open issue${top.issues.length > 1 ? 's' : ''}: ${top.issues.map((i) => `${i.title} (${i.severity}, ${i.ageDays}d)`).join('; ')}.` : '',
    `To unblock: ${top.unblockCondition}`,
    top.rule
      ? `Basis: ${ruleLine(ctx, top.rule.ruleCode)}.`
      : top.gateKind === 'CONFIGURED' ? 'Basis: this is a configured prerequisite in the workflow template; no verified rule is recorded for it, so it is not presented as a statutory requirement.' : '',
    ctx.blockers.length > 1 ? `${plural(ctx.blockers.length - 1, 'other blocker')} also flagged.` : '',
  ].filter(Boolean);
  return {
    answer: parts.join('\n\n'),
    factsUsed: [
      `${top.nodeCode}: ${top.activationState}, ${top.ageDays}d old${top.slaDays != null ? `, SLA ${top.slaDays}d` : ''}`,
      `downstream steps: ${top.downstream.map((d) => d.nodeCode).join(', ')}`,
      ...top.issues.map((i) => `issue "${i.title}" (${i.severity})`),
    ],
    rulesUsed: ruleCodes, sources: sourcesFor(ctx, ruleCodes), confidence: 'high',
    suggestions: [
      { type: 'BLOCKER', title: `Resolve: ${top.nodeName}`, rationale: top.unblockCondition },
      ...(top.overdue ? [{ type: 'ESCALATION_REVIEW' as const, title: 'Review whether a reminder to the responsible position is warranted', rationale: `The step is ${top.overdueDays} day(s) past its configured SLA (an operational target, not a statutory limit).` }] : []),
    ],
  };
}

function nextActions(ctx: AiContext): Out {
  if (!ctx.nodes.length) return noWorkflow(ctx);
  const actions: { type: Out['suggestions'][number]['type']; title: string; rationale: string }[] = [];
  for (const b of ctx.blockers) actions.push({ type: 'BLOCKER', title: `Clear the root blocker: ${b.nodeName}`, rationale: `${b.unblockCondition} (holding back ${plural(b.downstreamCount, 'step')}).` });
  for (const a of ctx.approvals.filter((x) => ['PENDING', 'IN_REVIEW', 'RETURNED'].includes(x.status))) {
    const label = a.type.replace(/_/g, ' ').toLowerCase();
    if (a.resolution !== 'RESOLVED' && a.resolution !== 'MANUAL_REVIEW') actions.push({ type: 'ESCALATION_REVIEW', title: `Manual authority review for ${label}`, rationale: 'No verified competent authority could be resolved; an authorized administrator must assign the deciding position. No automatic assignment was made.' });
    else if (a.status === 'IN_REVIEW') actions.push({ type: 'NEXT_ACTION', title: `Decision pending: ${label}`, rationale: `Awaiting a decision by ${a.decidingPosition ?? 'the competent authority'}.${a.syntheticAuthority ? ' (Authority band is a synthetic demo placeholder.)' : ''}` });
    else actions.push({ type: 'NEXT_ACTION', title: `Prepare and submit: ${label}`, rationale: `Once documents are attached, submit for decision by ${a.decidingPosition ?? 'the competent authority'}.` });
  }
  for (const n of ctx.nodes.filter((x) => ['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(x.state) && x.missingDocuments.length)) {
    actions.push({ type: 'DOCUMENT_GAP', title: `Provide documents for ${n.name}`, rationale: `Missing: ${n.missingDocuments.join(', ')}.` });
  }
  for (const n of ctx.nodes.filter((x) => x.pendingFacts.length)) {
    actions.push({ type: 'NEXT_ACTION', title: `Confirm applicability of ${n.name}`, rationale: `Record the project fact(s): ${n.pendingFacts.join(', ')}. Until then this step is shown as conditional - pending verification.` });
  }
  const parallel = ctx.parallelEligible.filter((p) => !ctx.blockers.some((b) => b.nodeCode === p.nodeCode));
  if (parallel.length > 1) actions.push({ type: 'PARALLEL_WORK', title: 'These steps can proceed in parallel', rationale: `${parallel.map((p) => p.name).join('; ')} do not depend on each other (operational optimisation, not a legal rule).` });
  const top = actions.slice(0, 6);
  return {
    answer: top.length ? top.map((a, i) => `${i + 1}. ${a.title} - ${a.rationale}`).join('\n') : 'Nothing needs action right now: no blockers, pending approvals or missing documents were found on the live steps.',
    factsUsed: [`${ctx.workflowSummary.eligible + ctx.workflowSummary.active} live step(s)`, `${ctx.blockers.length} flagged blocker(s)`, `${ctx.approvals.filter((a) => a.status !== 'APPROVED').length} open approval(s)`],
    rulesUsed: [], sources: [], confidence: 'high', suggestions: top,
  };
}

function whyRequired(ctx: AiContext, nodeCode?: string): Out {
  const n = ctx.nodes.find((x) => x.code === nodeCode);
  if (!n) return { answer: 'I could not find that workflow step in this project.', factsUsed: [], rulesUsed: [], sources: [], confidence: 'low', suggestions: [] };
  const ap = ctx.approvals.find((a) => a.nodeCode === n.code);
  const rule = n.ruleCode ? ctx.rules.find((r) => r.ruleCode === n.ruleCode) : undefined;
  let answer: string;
  switch (n.gateKind) {
    case 'RULE_BACKED':
      answer = `${n.name} is a mandatory gate under a verified rule. ${rule ? ruleLine(ctx, rule.ruleCode) : ''}`;
      break;
    case 'CONFIGURED':
      answer = `${n.name} is a configured prerequisite in the workflow template. No verified rule is recorded for it, so it is not presented as a statutory requirement.`;
      break;
    case 'ADVISORY':
      answer = `${n.name} appears in the workflow, but its linked rule is advisory only and not enforceable (${rule ? ruleLine(ctx, rule.ruleCode) : 'rule not in the verified context'}). It is not treated as a legal requirement; manual verification is required.`;
      break;
    case 'CONDITIONAL_PENDING':
      answer = `${n.name} applies only if a project fact holds, and that fact is not recorded yet (${n.pendingFacts.join(', ')}). Manual verification is required.${rule ? ` Basis if it applies: ${ruleLine(ctx, rule.ruleCode)}` : ''}`;
      break;
    default:
      answer = `${n.name} does not apply to this project (its activation condition was evaluated as not applicable).`;
  }
  if (ap) {
    answer += ap.resolution === 'RESOLVED'
      ? `\n\nDeciding authority: ${ap.decidingPosition}.${ap.syntheticAuthority ? ' This routing comes from a SYNTHETIC DEMO delegation matrix, not a real government rule.' : ''}`
      : '\n\nThe system could not resolve a verified competent authority for this project state. No automatic assignment was made.';
  }
  const codes = rule ? [rule.ruleCode] : [];
  return {
    answer, factsUsed: [`${n.code}: ${n.state}, gate kind ${n.gateKind}`], rulesUsed: codes, sources: sourcesFor(ctx, codes),
    confidence: n.gateKind === 'RULE_BACKED' || n.gateKind === 'CONFIGURED' ? 'high' : 'medium',
    suggestions: [{ type: 'RULE_EXPLANATION', title: `Basis for ${n.name}`, rationale: n.gateKind === 'RULE_BACKED' ? 'Backed by a verified, executable rule.' : 'Not backed by an executable verified rule; treat as advisory.' }],
  };
}

function missingDocuments(ctx: AiContext): Out {
  if (!ctx.nodes.length) return noWorkflow(ctx);
  const live = ctx.nodes.filter((n) => ['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(n.state) && n.missingDocuments.length);
  const later = ctx.nodes.filter((n) => n.state === 'INACTIVE' && n.missingDocuments.length).length;
  return {
    answer: live.length
      ? `Documents needed now:\n${live.map((n) => `- ${n.name}: ${n.missingDocuments.join(', ')}`).join('\n')}\n\n${later ? `${plural(later, 'later step')} will also need documents once they become ready.` : ''}`.trim()
      : `No documents are missing on the steps that are currently live.${later ? ` ${plural(later, 'later step')} will need documents once they become ready.` : ''}`,
    factsUsed: live.map((n) => `${n.code}: missing ${n.missingDocuments.join(', ')}`), rulesUsed: [], sources: [], confidence: 'high',
    suggestions: live.map((n) => ({ type: 'DOCUMENT_GAP' as const, title: `Upload for ${n.name}`, rationale: n.missingDocuments.join(', ') })),
  };
}

function summarize(ctx: AiContext): Out {
  if (!ctx.nodes.length) return noWorkflow(ctx);
  const s = ctx.workflowSummary;
  const lines = [
    `${ctx.project.code} - ${ctx.project.name} (${ctx.project.department}) is in the ${ctx.project.stage.replace(/_/g, ' ').toLowerCase()} stage with operational status ${ctx.project.status.replace(/_/g, ' ').toLowerCase()}.`,
    `Workflow: ${s.completed} of ${s.total} steps complete, ${s.eligible + s.active} in progress, ${s.blocked} blocked, ${s.pendingVerification} awaiting a project fact, ${s.notApplicable} not applicable.`,
    ctx.blockers[0] ? ctx.blockers[0].message : 'No root blocker is flagged.',
    ctx.approvals.some((a) => ['PENDING', 'IN_REVIEW', 'RETURNED'].includes(a.status)) ? `Open approvals: ${ctx.approvals.filter((a) => ['PENDING', 'IN_REVIEW', 'RETURNED'].includes(a.status)).map((a) => `${a.type.replace(/_/g, ' ').toLowerCase()} (${a.status.toLowerCase().replace('_', ' ')})`).join(', ')}.` : '',
    ctx.openIssues.length ? `Open issues: ${ctx.openIssues.map((i) => `${i.title} (${i.severity})`).join('; ')}.` : '',
    ctx.recentActivity.length ? `Latest activity: ${ctx.recentActivity.slice(0, 3).map((a) => a.action).join(', ')}.` : '',
  ].filter(Boolean);
  return { answer: lines.join('\n\n'), factsUsed: [`${s.total} workflow steps`, `${ctx.openIssues.length} open issue(s)`], rulesUsed: [], sources: [], confidence: 'high', suggestions: [] };
}

function ask(ctx: AiContext, question: string, nodeCode?: string): Out {
  const q = question.toLowerCase();
  if (/(block|delay|stuck|held up|hold(ing)? up|slow)/.test(q)) return explainBlocker(ctx);
  if (/(parallel|same time|simultaneous|independent)/.test(q)) return nextActions(ctx);
  if (/(document|missing|upload|paper)/.test(q)) return missingDocuments(ctx);
  if (/(next|do now|action|should we|what can)/.test(q)) return nextActions(ctx);
  if (/(why|required|requirement|rule|basis)/.test(q)) {
    const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const scored = ctx.nodes.map((n) => ({ n, score: words.filter((w) => n.name.toLowerCase().includes(w) || n.code.toLowerCase().includes(w)).length })).sort((a, b) => b.score - a.score);
    const target = nodeCode ?? (scored[0] && scored[0].score > 0 ? scored[0].n.code : ctx.blockers[0]?.nodeCode);
    if (target) return whyRequired(ctx, target);
  }
  const base = summarize(ctx);
  return { ...base, answer: `${base.answer}\n\nI answer only from this project's data. Try: "What is blocking this project?", "What can proceed in parallel?", "Why is this approval required?" or "What documents are missing?".`, confidence: 'medium' };
}

/** Offline provider: builds every answer from the same verified context via templates. Also the fallback for the LLM provider. */
export class DeterministicProvider implements AiProvider {
  readonly name = 'deterministic' as const;
  readonly model = 'rule-based-v1';
  async complete(req: AiRequest): Promise<AiRawAnswer> {
    switch (req.mode) {
      case 'EXPLAIN_BLOCKER': return explainBlocker(req.context);
      case 'NEXT_ACTIONS': return nextActions(req.context);
      case 'WHY_REQUIRED': return whyRequired(req.context, req.nodeCode);
      case 'MISSING_DOCUMENTS': return missingDocuments(req.context);
      case 'SUMMARIZE': return summarize(req.context);
      case 'ASK': return ask(req.context, req.question ?? '', req.nodeCode);
    }
  }
}
