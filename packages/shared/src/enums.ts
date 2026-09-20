// Enums mirrored from SQL CHECK constraints (infraflow-gov-project/db/migrations). Keep in sync.

export const ROLE_CODES = [
  'SYSTEM_ADMIN',
  'DEPARTMENT_OFFICER',
  'TECHNICAL_OFFICER',
  'APPROVING_AUTHORITY',
  'MONITORING_OFFICER',
  'FIELD_INSPECTOR',
  'CONTRACTOR',
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const APPROVAL_STATUSES = ['PENDING', 'IN_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const NODE_ACTIVATION_STATES = [
  'INACTIVE',
  'ELIGIBLE',
  'ACTIVE',
  'SKIPPED',
  'NOT_APPLICABLE',
  'BLOCKED',
  'COMPLETED',
] as const;
export type NodeActivationState = (typeof NODE_ACTIVATION_STATES)[number];

export const NODE_EXECUTION_STATES = [
  'PENDING',
  'IN_PROGRESS',
  'WAITING',
  'COMPLETED',
  'RETURNED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
] as const;
export type NodeExecutionState = (typeof NODE_EXECUTION_STATES)[number];

export const DEPENDENCY_TYPES = ['BLOCKING', 'REQUIRES_COMPLETION', 'INFORMATIONAL', 'PARALLEL', 'CONDITIONAL'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const RESOLUTION_STATUSES = [
  'RESOLVED',
  'UNRESOLVED',
  'AMBIGUOUS',
  'NO_RULE',
  'INACTIVE_POSITION',
  'MANUAL_REVIEW',
] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'INSUFFICIENT_SCOPE',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'STATE_CONFLICT',
  'RULE_NOT_VERIFIED',
  'AUTHORITY_NOT_RESOLVED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
