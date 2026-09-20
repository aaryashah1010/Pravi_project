import { z } from 'zod';

const money = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,16}(\.\d{1,2})?$/.test(v), 'Enter a non-negative amount with up to 2 decimals');

const optionalText = (max = 300) => z.string().trim().max(max).optional();

export const POSSESSION_STATUSES = ['UNKNOWN', 'PENDING', 'AVAILABLE', 'HANDED_OVER', 'DISPUTED', 'NOT_APPLICABLE'] as const;

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(200),
  projectTypeCode: z.string().trim().default('GOV_BUILDING'),
  departmentOrganizationId: z.string().uuid(),
  owningOfficeId: z.string().uuid(),
  primaryJurisdictionId: z.string().uuid().optional(),
  estimatedCost: money,
  fundingSourceCode: z.string().trim().optional(),
  attributes: z.record(z.unknown()).default({}),
  site: z
    .object({
      addressLine: optionalText(),
      city: optionalText(100),
      district: optionalText(100),
      taluka: optionalText(100),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      landOwner: optionalText(),
      possessionStatus: z.enum(POSSESSION_STATUSES).optional(),
    })
    .optional(),
  proposal: z
    .object({
      justification: z.string().trim().min(10, 'Please give a short justification (min 10 characters)').max(4000),
      fundingNotes: optionalText(2000),
    })
    .optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  versionNo: z.number().int().positive(),
  name: z.string().trim().min(3).max(200).optional(),
  attributes: z.record(z.unknown()).optional(),
  site: CreateProjectSchema.shape.site,
  estimatedCost: money.optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export interface ProjectSummaryDto {
  id: string;
  code: string;
  name: string;
  lifecycleStage: string;
  operationalStatus: string;
  estimatedCost: string;
  currency: string;
  departmentCode: string;
  departmentName: string;
  owningOfficeName: string;
  jurisdictionName: string | null;
  isDemo: boolean;
  hasWorkflow: boolean;
  openTaskCount: number;
  openApprovalCount: number;
  createdAt: string;
}

export interface ProjectDetailDto extends ProjectSummaryDto {
  projectType: { code: string; name: string };
  attributes: Record<string, unknown>;
  versionNo: number;
  createdBy: { id: string; name: string };
  owningOfficeId: string;
  departmentOrganizationId: string;
  site: {
    addressLine: string | null;
    city: string | null;
    district: string | null;
    taluka: string | null;
    latitude: string | null;
    longitude: string | null;
    landOwner: string | null;
    possessionStatus: string;
    surveyStatus: string;
    soilInvestigationStatus: string;
  } | null;
  proposal: { versionNo: number; status: string; justification: string; preliminaryEstimate: string } | null;
}

export type GateKind = 'RULE_BACKED' | 'CONFIGURED' | 'ADVISORY' | 'CONDITIONAL_PENDING' | 'NOT_APPLICABLE';

export type TrustBadge =
  | 'VERIFIED_SOURCE'
  | 'CONDITIONAL'
  | 'CONTRACT_SPECIFIC'
  | 'CURRENCY_CHECK_REQUIRED'
  | 'ADVISORY_ONLY'
  | 'NOT_VERIFIED'
  | 'SUPERSEDED'
  | 'SYNTHETIC_DEMO';

export interface WorkflowNodeDto {
  id: string;
  nodeCode: string;
  name: string;
  nodeType: string;
  activationState: string;
  executionState: string;
  gateKind: GateKind;
  conditionPending: { facts: string[]; message: string } | null;
  slaDays: number | null;
  eligibleAt: string | null;
  dueAt: string | null;
  ageDays: number | null;
  overdue: boolean;
  completedAt: string | null;
  assignedPosition: {
    id: string;
    code: string;
    designation: string;
    officeName: string;
    holder: { userId: string; displayName: string } | null;
  } | null;
  rule: { id: string; ruleCode: string; name: string; trustBadge: TrustBadge; statement: string | null } | null;
  approval: ApprovalBriefDto | null;
  requiredDocuments: { documentTypeCode: string; name: string; status: string }[];
  openIssueCount: number;
}

export interface WorkflowEdgeDto {
  id: string;
  from: string;
  to: string;
  dependencyType: string;
  originalType: string;
  state: string;
}

export interface WorkflowDto {
  instanceId: string;
  projectId: string;
  state: string;
  templateCode: string;
  templateVersion: number;
  generatedAt: string;
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
  summary: {
    total: number;
    completed: number;
    eligible: number;
    active: number;
    blocked: number;
    notApplicable: number;
    pendingVerification: number;
  };
}

export interface ApprovalBriefDto {
  id: string;
  approvalType: string;
  status: string;
  resolutionStatus: string | null;
  requiresManualReview: boolean;
  syntheticAuthority: boolean;
}
