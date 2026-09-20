import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export interface MeRole {
  code: string;
  organizationId: string | null;
  officeId: string | null;
  jurisdictionId: string | null;
}

export interface MePosition {
  positionId: string;
  positionCode: string;
  designation: string;
  officeId: string;
  officeName: string;
  assignmentType: string;
}

export interface MeDto {
  user: { id: string; email: string; displayName: string };
  roles: MeRole[];
  permissions: string[];
  positions: MePosition[];
  contractorIds: string[];
}

export interface LoginResponse {
  token: string;
  expiresIn: string;
  me: MeDto;
}

/** Demo persona shortcuts shown on the login page (all synthetic). */
export const DEMO_PERSONAS = [
  { key: 'officer', email: 'officer@demo.infraflow.local', label: 'Department Officer', hint: 'Creates projects, submits approvals' },
  { key: 'engineer', email: 'engineer@demo.infraflow.local', label: 'Assistant Engineer', hint: 'Design & estimate, technical review' },
  { key: 'approver', email: 'approver@demo.infraflow.local', label: 'Executive Engineer', hint: 'Approving authority (division)' },
  { key: 'se', email: 'se@demo.infraflow.local', label: 'Superintending Engineer', hint: 'Approving authority (district)' },
  { key: 'inspector', email: 'inspector@demo.infraflow.local', label: 'Field Inspector (JE)', hint: 'Inspections & evidence' },
  { key: 'monitor', email: 'monitor@demo.infraflow.local', label: 'Monitoring Officer', hint: 'Portfolio, blockers, audit' },
  { key: 'contractor', email: 'contractor@demo.infraflow.local', label: 'Contractor', hint: 'Progress & evidence submissions' },
  { key: 'admin', email: 'admin@demo.infraflow.local', label: 'System Admin', hint: 'Organisation, rules, manual review' },
] as const;
