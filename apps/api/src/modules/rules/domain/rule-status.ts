// Pure rule-status logic. No HTTP/DB imports. This is the single definition of "executable" used everywhere.

export type EnforcementMode = 'ENFORCEABLE' | 'ADVISORY_ONLY' | 'NON_ENFORCEABLE';
export type VerificationStatus = 'DRAFT' | 'VERIFIED' | 'UNVERIFIED' | 'SUPERSEDED' | 'DISABLED';

export type TrustBadge =
  | 'VERIFIED_SOURCE'
  | 'CONDITIONAL'
  | 'CONTRACT_SPECIFIC'
  | 'CURRENCY_CHECK_REQUIRED'
  | 'ADVISORY_ONLY'
  | 'NOT_VERIFIED'
  | 'SUPERSEDED'
  | 'SYNTHETIC_DEMO';

export interface RuleVersionLike {
  enforcement_mode: EnforcementMode;
  verification_status: VerificationStatus;
  effective_from: string | null; // 'YYYY-MM-DD'
  effective_to: string | null;
  scope: Record<string, unknown>;
  conditions: Record<string, unknown>;
  action: Record<string, unknown>;
}

const toDay = (d: Date | string): string => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Executable ⇔ ENFORCEABLE ∧ VERIFIED ∧ effective window covers `at`. Anything else can never block/route/approve. */
export function isExecutable(rule: Pick<RuleVersionLike, 'enforcement_mode' | 'verification_status' | 'effective_from' | 'effective_to'>, at: Date | string): boolean {
  if (rule.enforcement_mode !== 'ENFORCEABLE') return false;
  if (rule.verification_status !== 'VERIFIED') return false;
  const day = toDay(at);
  if (rule.effective_from && rule.effective_from > day) return false;
  if (rule.effective_to && rule.effective_to < day) return false;
  return true;
}

/** Trust badge shown in the UI. Precedence matters: synthetic and unverified must never look "verified". */
export function deriveTrustBadge(rule: RuleVersionLike, at: Date | string = new Date()): TrustBadge {
  if (rule.verification_status === 'SUPERSEDED') return 'SUPERSEDED';
  if (rule.scope?.synthetic === true) return 'SYNTHETIC_DEMO';
  if (rule.verification_status !== 'VERIFIED') return 'NOT_VERIFIED';
  if (rule.scope?.contractSpecific === true) return 'CONTRACT_SPECIFIC';
  if (rule.scope?.currency_check_required === true || rule.action?.currency_check_required === true) return 'CURRENCY_CHECK_REQUIRED';
  if (rule.enforcement_mode !== 'ENFORCEABLE') return 'ADVISORY_ONLY';
  if (!isExecutable(rule, at)) return 'NOT_VERIFIED';
  if (rule.scope?.conditional === true) return 'CONDITIONAL';
  return 'VERIFIED_SOURCE';
}
