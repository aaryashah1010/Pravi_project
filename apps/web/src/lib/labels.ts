import type { GateKind, TrustBadge } from '@infraflow/shared';
import { humanize } from './format';

export type Tone = 'emerald' | 'amber' | 'rose' | 'slate' | 'blue' | 'navy';

/** Full class names must stay literal so Tailwind can see them. */
export const TONE: Record<Tone, { bg: string; border: string; text: string; dot: string; solid: string; rail: string; soft: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-600', solid: 'bg-emerald-600 text-white', rail: 'bg-emerald-600', soft: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-600', solid: 'bg-amber-600 text-white', rail: 'bg-amber-500', soft: 'text-amber-700' },
  rose: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', dot: 'bg-red-600', solid: 'bg-red-600 text-white', rail: 'bg-red-600', soft: 'text-red-700' },
  slate: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600', dot: 'bg-slate-500', solid: 'bg-slate-600 text-white', rail: 'bg-slate-400', soft: 'text-slate-500' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', dot: 'bg-blue-600', solid: 'bg-blue-600 text-white', rail: 'bg-blue-600', soft: 'text-blue-700' },
  navy: { bg: 'bg-primary-fixed', border: 'border-primary-fixed-dim', text: 'text-primary', dot: 'bg-primary-container', solid: 'bg-primary-container text-white', rail: 'bg-primary-container', soft: 'text-primary' },
};

export interface StatusStyle {
  label: string;
  tone: Tone;
  icon: string;
}

export function projectStatus(status: string): StatusStyle {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', tone: 'emerald', icon: 'check_circle' };
    case 'AT_RISK':
      return { label: 'At risk', tone: 'amber', icon: 'warning' };
    case 'BLOCKED':
      return { label: 'Blocked', tone: 'rose', icon: 'block' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'emerald', icon: 'task_alt' };
    case 'CLOSED':
      return { label: 'Closed', tone: 'slate', icon: 'lock' };
    case 'ON_HOLD':
      return { label: 'On hold', tone: 'slate', icon: 'pause_circle' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'slate', icon: 'cancel' };
    default:
      return { label: humanize(status), tone: 'slate', icon: 'help' };
  }
}

export function approvalStatus(status: string): StatusStyle {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending submission', tone: 'amber', icon: 'schedule' };
    case 'IN_REVIEW':
      return { label: 'In review', tone: 'blue', icon: 'rate_review' };
    case 'RETURNED':
      return { label: 'Returned', tone: 'amber', icon: 'undo' };
    case 'APPROVED':
      return { label: 'Approved', tone: 'emerald', icon: 'verified' };
    case 'REJECTED':
      return { label: 'Rejected', tone: 'rose', icon: 'cancel' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'slate', icon: 'block' };
    default:
      return { label: humanize(status), tone: 'slate', icon: 'help' };
  }
}

export function docRequirementStatus(status: string): StatusStyle {
  switch (status) {
    case 'MISSING':
      return { label: 'Missing', tone: 'rose', icon: 'error' };
    case 'SUBMITTED':
      return { label: 'Submitted', tone: 'blue', icon: 'upload_file' };
    case 'VERIFIED':
      return { label: 'Verified', tone: 'emerald', icon: 'verified' };
    case 'REJECTED':
      return { label: 'Rejected', tone: 'rose', icon: 'cancel' };
    case 'WAIVED':
      return { label: 'Waived', tone: 'slate', icon: 'remove_done' };
    default:
      return { label: humanize(status), tone: 'slate', icon: 'help' };
  }
}

export function taskStatus(status: string, overdue = false): StatusStyle {
  if (overdue && isOpenTaskStatus(status)) return { label: 'Overdue', tone: 'amber', icon: 'schedule' };
  switch (status) {
    case 'COMPLETED':
      return { label: 'Completed', tone: 'emerald', icon: 'check_circle' };
    case 'IN_PROGRESS':
      return { label: 'In progress', tone: 'blue', icon: 'play_circle' };
    case 'PENDING':
      return { label: 'Pending', tone: 'blue', icon: 'radio_button_checked' };
    case 'BLOCKED':
      return { label: 'Blocked', tone: 'rose', icon: 'block' };
    case 'OVERDUE':
      return { label: 'Overdue', tone: 'amber', icon: 'schedule' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'slate', icon: 'cancel' };
    default:
      return { label: humanize(status), tone: 'slate', icon: 'help' };
  }
}

/** Server task statuses: PENDING | IN_PROGRESS | BLOCKED | OVERDUE | COMPLETED | CANCELLED — there is no OPEN. */
export function isOpenTaskStatus(status: string): boolean {
  return status !== 'COMPLETED' && status !== 'CANCELLED';
}

/** Issue statuses: OPEN | IN_PROGRESS | BLOCKED are unresolved; RESOLVED | CLOSED | CANCELLED are not. */
export function isOpenIssueStatus(status: string): boolean {
  return status === 'OPEN' || status === 'IN_PROGRESS' || status === 'BLOCKED';
}

export const LIFECYCLE_STAGES: { key: string; label: string }[] = [
  { key: 'IDENTIFICATION', label: 'Identification' },
  { key: 'PROPOSAL', label: 'Proposal' },
  { key: 'SITE_READINESS', label: 'Site readiness' },
  { key: 'FUNDING', label: 'Funding' },
  { key: 'ADMINISTRATIVE_APPROVAL', label: 'Admin approval' },
  { key: 'DESIGN', label: 'Design' },
  { key: 'TECHNICAL_SANCTION', label: 'Technical sanction' },
  { key: 'CLEARANCES', label: 'Clearances' },
  { key: 'PROCUREMENT', label: 'Procurement' },
  { key: 'AWARD', label: 'Award' },
  { key: 'CONTRACT', label: 'Contract' },
  { key: 'WORK_ORDER', label: 'Work order' },
  { key: 'CONSTRUCTION', label: 'Construction' },
  { key: 'INSPECTION', label: 'Inspection' },
  { key: 'BILLING', label: 'Billing' },
  { key: 'COMPLETION', label: 'Completion' },
  { key: 'HANDOVER', label: 'Handover' },
  { key: 'DLP', label: 'Defect liability' },
  { key: 'CLOSED', label: 'Closed' },
];

export function taskPriority(priority: string): StatusStyle {
  switch (priority) {
    case 'CRITICAL':
      return { label: 'Critical', tone: 'rose', icon: 'priority_high' };
    case 'HIGH':
      return { label: 'High', tone: 'amber', icon: 'arrow_upward' };
    case 'LOW':
      return { label: 'Low', tone: 'slate', icon: 'arrow_downward' };
    default:
      return { label: humanize(priority), tone: 'slate', icon: 'remove' };
  }
}

export function nodeState(activation: string, overdue: boolean): StatusStyle {
  if (overdue && ['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(activation)) {
    return { label: 'Overdue', tone: 'amber', icon: 'schedule' };
  }
  switch (activation) {
    case 'COMPLETED':
      return { label: 'Completed', tone: 'emerald', icon: 'check_circle' };
    case 'ACTIVE':
      return { label: 'In progress', tone: 'blue', icon: 'play_circle' };
    case 'ELIGIBLE':
      return { label: 'Eligible', tone: 'blue', icon: 'radio_button_checked' };
    case 'BLOCKED':
      return { label: 'Blocked', tone: 'rose', icon: 'block' };
    case 'NOT_APPLICABLE':
      return { label: 'Not applicable', tone: 'slate', icon: 'do_not_disturb_on' };
    case 'SKIPPED':
      return { label: 'Skipped', tone: 'slate', icon: 'skip_next' };
    case 'INACTIVE':
      return { label: 'Waiting on prerequisites', tone: 'slate', icon: 'hourglass_empty' };
    default:
      return { label: humanize(activation), tone: 'slate', icon: 'help' };
  }
}

export const GATE_KIND_LABEL: Record<GateKind, string> = {
  RULE_BACKED: 'Mandatory gate (verified rule)',
  CONFIGURED: 'Configured prerequisite',
  ADVISORY: 'Advisory (rule not enforceable)',
  CONDITIONAL_PENDING: 'Conditional — pending verification',
  NOT_APPLICABLE: 'Not applicable',
};

export const GATE_KIND_SHORT: Record<GateKind, string> = {
  RULE_BACKED: 'Gate',
  CONFIGURED: 'Configured',
  ADVISORY: 'Advisory',
  CONDITIONAL_PENDING: 'Conditional',
  NOT_APPLICABLE: 'N/A',
};

export const GATE_KIND_ICON: Record<GateKind, string> = {
  RULE_BACKED: 'verified',
  CONFIGURED: 'tune',
  ADVISORY: 'info',
  CONDITIONAL_PENDING: 'help',
  NOT_APPLICABLE: 'do_not_disturb_on',
};

export interface TrustStyle {
  label: string;
  tone: Tone;
  icon: string;
  outline?: boolean;
  upper?: boolean;
}

export function trustStyle(badge: TrustBadge): TrustStyle {
  switch (badge) {
    case 'VERIFIED_SOURCE':
      return { label: 'Verified source', tone: 'emerald', icon: 'verified' };
    case 'CONDITIONAL':
      return { label: 'Conditional requirement', tone: 'slate', icon: 'rule' };
    case 'CONTRACT_SPECIFIC':
      return { label: 'Contract-specific', tone: 'slate', icon: 'description' };
    case 'CURRENCY_CHECK_REQUIRED':
      return { label: 'Currency check required', tone: 'amber', icon: 'update' };
    case 'ADVISORY_ONLY':
      return { label: 'Advisory', tone: 'slate', icon: 'info' };
    case 'NOT_VERIFIED':
      return { label: 'Not verified — manual verification required', tone: 'rose', icon: 'gpp_maybe', outline: true };
    case 'SUPERSEDED':
      return { label: 'Superseded', tone: 'slate', icon: 'history' };
    case 'SYNTHETIC_DEMO':
      return { label: 'Synthetic demo', tone: 'amber', icon: 'science' };
  }
}

const AUDIT_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Sign-in failed',
  'project.created': 'Project created',
  'project.submitted': 'Project submitted for workflow generation',
  'project.updated': 'Project facts updated',
  'workflow.generated': 'Workflow generated',
  'workflow.condition_resolved': 'Conditional step resolved',
  'approval_case.opened': 'Approval opened',
  'approval.submitted': 'Approval submitted for review',
  'approval.approve': 'Approval approved',
  'approval.return': 'Approval returned',
  'approval.reject': 'Approval rejected',
  'approval.request_information': 'Information requested',
  'approval.manual_assigned': 'Authority assigned manually',
  'document.uploaded': 'Document uploaded',
  'document.verified': 'Document verified',
  'document.rejected': 'Document rejected',
  'task.completed': 'Task completed',
  'tasks.marked_overdue': 'Tasks marked overdue',
  'contract.recorded': 'Contract recorded',
  'inspection.requested': 'Inspection requested',
  'inspection.submitted': 'Inspection submitted',
  'issue.raised': 'Issue raised',
  'issue.resolved': 'Issue resolved',
  'milestone.planned': 'Milestone planned',
  'milestone.progress_reported': 'Progress reported',
  'milestone.completed': 'Milestone completed',
  'ai.run': 'Copilot question answered (advisory)',
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? humanize(action);
}

export function auditIcon(action: string): string {
  const head = action.split('.')[0] ?? '';
  switch (head) {
    case 'auth':
      return 'login';
    case 'project':
      return 'folder_open';
    case 'workflow':
      return 'account_tree';
    case 'approval':
    case 'approval_case':
      return 'verified';
    case 'document':
      return 'description';
    case 'task':
    case 'tasks':
      return 'assignment_turned_in';
    case 'inspection':
      return 'fact_check';
    case 'issue':
      return 'report_problem';
    case 'milestone':
      return 'flag';
    case 'ai':
      return 'smart_toy';
    default:
      return 'history';
  }
}

const DECISION_LABELS: Record<string, string> = {
  SUBMIT: 'Submitted for review',
  APPROVE: 'Approved',
  RETURN: 'Returned',
  REJECT: 'Rejected',
  REQUEST_INFORMATION: 'Information requested',
  MANUAL_ASSIGN: 'Authority assigned manually',
};

export function decisionLabel(action: string): string {
  return DECISION_LABELS[action] ?? humanize(action);
}

export function decisionTone(action: string): Tone {
  switch (action) {
    case 'APPROVE':
      return 'emerald';
    case 'REJECT':
      return 'rose';
    case 'RETURN':
    case 'REQUEST_INFORMATION':
      return 'amber';
    case 'SUBMIT':
      return 'blue';
    default:
      return 'slate';
  }
}

export const TASK_TYPE_LABEL: Record<string, string> = {
  WORK_ITEM: 'Work item',
  APPROVAL_SUBMIT: 'Submit approval',
  APPROVAL_DECISION: 'Approval decision',
  CONDITION_VERIFICATION: 'Verify condition',
  MANUAL_AUTHORITY_REVIEW: 'Manual authority review',
  INSPECTION: 'Inspection',
  MILESTONE_UPDATE: 'Milestone update',
  RECTIFICATION: 'Rectification',
};

export function taskTypeLabel(t: string): string {
  return TASK_TYPE_LABEL[t] ?? humanize(t);
}

export const DOCUMENT_TYPES: { code: string; name: string }[] = [
  { code: 'BUDGET_PROVISION', name: 'Budget Provision Evidence' },
  { code: 'CLEARANCE_CERTIFICATE', name: 'Clearance / Permission Certificate' },
  { code: 'COMPLETION_CERTIFICATE', name: 'Completion Certificate' },
  { code: 'DPR', name: 'Detailed Project Report' },
  { code: 'DRAWING', name: 'Drawing / Plan' },
  { code: 'ESTIMATE', name: 'Detailed Estimate' },
  { code: 'HANDOVER_RECORD', name: 'Site Handover Record' },
  { code: 'INSPECTION_REPORT', name: 'Inspection Report' },
  { code: 'LAND_RECORD', name: 'Land / Site Record' },
  { code: 'MEASUREMENT_RECORD', name: 'Measurement Record' },
  { code: 'SITE_PHOTO', name: 'Site Photograph' },
  { code: 'TECHNICAL_NOTE', name: 'Technical Note' },
  { code: 'TENDER_DOCUMENT', name: 'Tender Document' },
  { code: 'WORK_ORDER_DOC', name: 'Work Order Document' },
];

export const POSSESSION_LABEL: Record<string, string> = {
  UNKNOWN: 'Unknown',
  PENDING: 'Pending',
  AVAILABLE: 'Available',
  HANDED_OVER: 'Handed over',
  DISPUTED: 'Disputed',
  NOT_APPLICABLE: 'Not applicable',
};

export const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: 'System Admin',
  DEPARTMENT_OFFICER: 'Department Officer',
  TECHNICAL_OFFICER: 'Technical Officer',
  APPROVING_AUTHORITY: 'Approving Authority',
  MONITORING_OFFICER: 'Monitoring Officer',
  FIELD_INSPECTOR: 'Field Inspector',
  CONTRACTOR: 'Contractor',
};
