import { z } from 'zod';
import type { TrustBadge } from './projects.js';

export const DecisionBodySchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});
export type DecisionBody = z.infer<typeof DecisionBodySchema>;

export const ManualAssignSchema = z.object({
  positionId: z.string().uuid(),
  reason: z.string().trim().min(10, 'Please record why this position is competent (min 10 characters)').max(2000),
});
export type ManualAssignBody = z.infer<typeof ManualAssignSchema>;

export interface PositionBriefDto {
  id: string;
  code: string;
  designation: string;
  officeName: string;
  holder: { userId: string; displayName: string } | null;
}

export interface RuleBriefDto {
  id: string;
  ruleCode: string;
  name: string;
  trustBadge: TrustBadge;
  statement: string | null;
  synthetic: boolean;
}

export interface ApprovalDto {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectCost: string;
  nodeCode: string;
  nodeName: string;
  approvalType: string;
  status: string;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  dueAt: string | null;
  ageDays: number;
  overdue: boolean;
  authority: {
    resolutionStatus: string | null;
    requiresManualReview: boolean;
    message: string | null;
    position: PositionBriefDto | null;
    ruleCode: string | null;
    rule: RuleBriefDto | null;
    synthetic: boolean;
  };
  nodeRule: RuleBriefDto | null;
  requiredDocuments: { code: string; name: string; status: string; required: boolean }[];
  decisions: { id: string; action: string; reason: string | null; at: string; actorName: string | null; actorDesignation: string | null; actorPositionCode: string | null }[];
  canSubmit: boolean;
  canDecide: boolean;
  canManualAssign: boolean;
  blockedReason: string | null;
}
