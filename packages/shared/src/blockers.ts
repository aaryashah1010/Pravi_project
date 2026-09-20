import type { GateKind, ProjectSummaryDto, TrustBadge } from './projects.js';

export interface BlockerDto {
  nodeCode: string;
  nodeName: string;
  nodeType: string;
  activationState: string;
  reason: 'ISSUE_BLOCKS' | 'APPROVAL_REJECTED' | 'SLA_OVERDUE';
  gateKind: GateKind;
  /** True only when a verified, executable rule backs this node (never for configured/advisory steps). */
  mandatoryGate: boolean;
  ageDays: number;
  slaDays: number | null;
  dueAt: string | null;
  overdue: boolean;
  overdueDays: number;
  downstreamCount: number;
  downstream: { nodeCode: string; name: string; depth: number }[];
  owner: { positionCode: string; designation: string; officeName: string; holderName: string | null } | null;
  issues: { id: string; title: string; severity: string; openedAt: string; ageDays: number }[];
  rule: { id: string; ruleCode: string; name: string; trustBadge: TrustBadge; statement: string | null } | null;
  unblockCondition: string;
  message: string;
}

export interface FrontierDto {
  nodeCode: string;
  nodeName: string;
  activationState: string;
  ageDays: number;
  overdue: boolean;
  downstreamCount: number;
  ownerDesignation: string | null;
}

export interface BlockersDto {
  projectId: string;
  projectCode: string;
  generatedAt: string;
  headline: string | null;
  blockers: BlockerDto[];
  frontier: FrontierDto[];
  parallelEligible: { nodeCode: string; name: string; ownerDesignation: string | null }[];
}

export interface AttentionItemDto {
  project: ProjectSummaryDto;
  blocker: BlockerDto;
  blockerCount: number;
}

export interface DashboardSummaryDto {
  generatedAt: string;
  projects: { active: number; totalValue: string; onTrack: number; atRisk: number; blocked: number; completed: number };
  approvals: { pending: number; avgAgeDays: number; overdue: number; byType: { type: string; count: number }[] };
  tasks: { open: number; overdue: number };
  issues: { open: number; critical: number };
  blockedDownstream: number;
  financial: { totalEstimated: string; totalSanctioned: string };
  progress: { plannedAvg: number; verifiedAvg: number; reportedAvg: number; milestones: number };
}

export interface OverdueItemDto {
  projectId: string;
  projectCode: string;
  projectName: string;
  nodeCode: string;
  nodeName: string;
  ageDays: number;
  overdueDays: number;
  slaDays: number | null;
  ownerDesignation: string | null;
  ownerHolder: string | null;
}
