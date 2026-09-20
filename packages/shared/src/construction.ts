import { z } from 'zod';

export const ISSUE_CATEGORIES = [
  'land_site', 'design', 'approval', 'procurement', 'utility', 'material', 'labour', 'weather', 'contractor', 'quality', 'finance', 'safety', 'other',
] as const;
export const ISSUE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const CreateIssueSchema = z.object({
  title: z.string().trim().min(5, 'Give the issue a short title (min 5 characters)').max(200),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(ISSUE_CATEGORIES),
  severity: z.enum(ISSUE_SEVERITIES).default('MEDIUM'),
  /** Workflow node codes this issue prevents from progressing (root-blocker input). */
  blocksNodes: z.array(z.string().min(1)).default([]),
  affectsNodes: z.array(z.string().min(1)).default([]),
  ownerPositionId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});
export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

export const ResolveIssueSchema = z.object({ resolution: z.string().trim().min(5, 'Describe how the issue was resolved').max(2000) });

export interface IssueDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  status: string;
  openedAt: string;
  dueAt: string | null;
  resolvedAt: string | null;
  ageDays: number;
  overdue: boolean;
  createdBy: string | null;
  owner: { positionCode: string; designation: string } | null;
  blocks: { nodeCode: string; name: string }[];
  affects: { nodeCode: string; name: string }[];
  resolution: string | null;
}

export const ProgressSchema = z.object({
  reportedProgress: z.number().min(0).max(100),
  narrative: z.string().trim().max(2000).optional(),
});

export const PlanMilestoneSchema = z.object({
  plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedFinish: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedProgress: z.number().min(0).max(100).optional(),
});

export interface MilestoneDto {
  id: string;
  projectId: string;
  code: string;
  name: string;
  sequenceNo: number | null;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  plannedProgress: number;
  reportedProgress: number;
  verifiedProgress: number;
  /** verified - planned, in percentage points (never uses contractor-reported progress). */
  variance: number;
  lastUpdate: { at: string; by: string; narrative: string | null; reportedProgress: number } | null;
  inspectionCounts: { total: number; pass: number; fail: number; pending: number; observation: number };
  openBlockingIssues: number;
  nodeCode: string | null;
}

export const INSPECTION_RESULTS = ['PASS', 'FAIL', 'OBSERVATION'] as const;
export const CHECKLIST_RESULTS = ['PASS', 'FAIL', 'NA', 'OBSERVATION'] as const;

export const CreateInspectionSchema = z.object({
  milestoneCode: z.string().min(1),
  templateCode: z.string().min(1).default('STRUCTURAL-WORK-CHECK'),
  note: z.string().trim().max(1000).optional(),
});

export const SubmitInspectionSchema = z.object({
  result: z.enum(INSPECTION_RESULTS),
  observations: z.string().trim().max(4000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  checklist: z.array(z.object({ itemCode: z.string().min(1), result: z.enum(CHECKLIST_RESULTS), notes: z.string().trim().max(1000).optional() })).min(1),
  /** Inspector-verified progress for the milestone (never taken from the contractor). */
  verifiedProgress: z.number().min(0).max(100).optional(),
  measurement: z
    .object({ reference: z.string().trim().min(1).max(100), quantity: z.number().nonnegative(), unit: z.string().trim().min(1).max(20) })
    .optional(),
});
export type SubmitInspectionInput = z.infer<typeof SubmitInspectionSchema>;

export interface InspectionDto {
  id: string;
  projectId: string;
  projectCode: string;
  milestoneCode: string | null;
  milestoneName: string | null;
  templateCode: string | null;
  templateName: string | null;
  checklistSchema: { code: string; label: string }[];
  result: string;
  requestedAt: string | null;
  requestedBy: string | null;
  inspectedAt: string | null;
  inspector: { positionCode: string; designation: string; holderName: string | null } | null;
  observations: string | null;
  latitude: string | null;
  longitude: string | null;
  checklistResults: { itemCode: string; label: string; result: string; notes: string | null }[];
  evidence: { documentId: string; title: string; mimeType: string; sha256: string; uploadedAt: string; latitude: number | null; longitude: number | null }[];
  measurements: { reference: string; quantity: string; unit: string; status: string }[];
  canSubmit: boolean;
  raisedIssueId: string | null;
}

export const ContractSchema = z.object({
  contractorCode: z.string().min(1),
  contractNumber: z.string().trim().min(3).max(60),
  awardedValue: z.union([z.string(), z.number()]).transform((v) => String(v)).refine((v) => /^\d{1,16}(\.\d{1,2})?$/.test(v), 'Invalid amount'),
  contractDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dlpMonths: z.number().int().min(0).max(120).optional(),
  workOrderNumber: z.string().trim().min(3).max(60).optional(),
});
export type ContractInput = z.infer<typeof ContractSchema>;

export interface ContractDto {
  contractNumber: string;
  contractor: { code: string; name: string };
  awardedValue: string;
  contractDate: string | null;
  startDate: string | null;
  completionDate: string | null;
  dlpStartDate: string | null;
  dlpEndDate: string | null;
  status: string;
  workOrder: { number: string; issueDate: string | null; status: string } | null;
}
