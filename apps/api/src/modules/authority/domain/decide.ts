// Authority resolution decisions (pure: no HTTP/DB). The resolver NEVER guesses:
// zero candidates, ambiguity, unknown facts, or a vacant seat all end in a manual-review status.
import type { Tri } from '../../rules/domain/condition.js';
import { type RuleVersionLike, isExecutable } from '../../rules/domain/rule-status.js';

export interface AuthorityCandidate {
  id: string;
  code: string;
  requiredPositionTypeId: string;
  routingScope: string;
  priority: number;
  hasDepartment: boolean;
  hasProjectType: boolean;
  hasJurisdictionType: boolean;
  hasCostBand: boolean;
  hasConditions: boolean;
  conditionsResult: Tri;
  ruleVersionId: string;
  ruleCode: string;
  rule: RuleVersionLike;
}

export interface ConsideredCandidate {
  code: string;
  ruleCode: string;
  specificity: number;
  priority: number;
  excluded: string | null;
}

export type Selection =
  | { status: 'SELECTED'; candidate: AuthorityCandidate; considered: ConsideredCandidate[] }
  | { status: 'NO_RULE'; considered: ConsideredCandidate[] }
  | { status: 'AMBIGUOUS'; considered: ConsideredCandidate[] }
  | { status: 'CONDITION_UNKNOWN'; considered: ConsideredCandidate[] };

export const specificity = (c: AuthorityCandidate): number =>
  [c.hasDepartment, c.hasProjectType, c.hasJurisdictionType, c.hasCostBand, c.hasConditions].filter(Boolean).length;

export function selectAuthorityRule(candidates: AuthorityCandidate[], at: Date | string): Selection {
  const considered: ConsideredCandidate[] = [];
  const live: AuthorityCandidate[] = [];
  let unknown = false;

  for (const c of candidates) {
    let excluded: string | null = null;
    if (!isExecutable(c.rule, at)) excluded = 'RULE_VERSION_NOT_EXECUTABLE';
    else if (c.conditionsResult === 'NO_MATCH') excluded = 'CONDITIONS_NOT_MET';
    else if (c.conditionsResult === 'INDETERMINATE') {
      excluded = 'CONDITIONS_UNKNOWN';
      unknown = true;
    }
    considered.push({ code: c.code, ruleCode: c.ruleCode, specificity: specificity(c), priority: c.priority, excluded });
    if (!excluded) live.push(c);
  }

  if (live.length === 0) return unknown ? { status: 'CONDITION_UNKNOWN', considered } : { status: 'NO_RULE', considered };

  const best = Math.max(...live.map(specificity));
  const top = live.filter((c) => specificity(c) === best);
  const bestPriority = Math.min(...top.map((c) => c.priority));
  const finalists = top.filter((c) => c.priority === bestPriority);

  // Duplicate rules that agree on the outcome are harmless; disagreement is ambiguity.
  const outcomes = new Set(finalists.map((c) => `${c.requiredPositionTypeId}|${c.routingScope}`));
  if (outcomes.size > 1) return { status: 'AMBIGUOUS', considered };
  return { status: 'SELECTED', candidate: finalists[0]!, considered };
}

export interface SeatHolder {
  userId: string;
  displayName: string;
  assignmentType: string;
}
export interface SeatCandidate {
  positionId: string;
  positionCode: string;
  /** Office that owns the seat (levels built from jurisdiction coverage can span several offices). */
  officeId?: string;
  holders: SeatHolder[];
}
export interface OfficeLevel {
  officeId: string;
  officeName: string;
  seats: SeatCandidate[]; // only positions of the required type
}

export type HolderDecision =
  | { status: 'RESOLVED'; officeId: string; positionId: string; userId: string; holders: SeatHolder[] }
  | { status: 'INACTIVE_POSITION'; officeId: string; positionId: string }
  | { status: 'AMBIGUOUS'; officeId: string }
  | { status: 'UNRESOLVED' };

/**
 * levels are ordered nearest-first. The NEAREST level that contains any seat of the required type decides;
 * we never skip past a vacant nearer seat to a farther one (that would be guessing who acts).
 */
export function decideHolder(levels: OfficeLevel[]): HolderDecision {
  for (const level of levels) {
    if (level.seats.length === 0) continue;
    if (level.seats.length > 1) return { status: 'AMBIGUOUS', officeId: level.officeId };
    const seat = level.seats[0]!;
    const officeId = seat.officeId ?? level.officeId;
    if (seat.holders.length === 0) return { status: 'INACTIVE_POSITION', officeId, positionId: seat.positionId };
    const primary = seat.holders.find((h) => h.assignmentType === 'PRIMARY') ?? seat.holders[0]!;
    return { status: 'RESOLVED', officeId, positionId: seat.positionId, userId: primary.userId, holders: seat.holders };
  }
  return { status: 'UNRESOLVED' };
}
