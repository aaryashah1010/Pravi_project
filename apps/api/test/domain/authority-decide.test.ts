import { describe, expect, it } from 'vitest';
import { type AuthorityCandidate, decideHolder, selectAuthorityRule } from '../../src/modules/authority/domain/decide.js';

const okRule = { enforcement_mode: 'ENFORCEABLE', verification_status: 'VERIFIED', effective_from: null, effective_to: null, scope: {}, conditions: {}, action: {} } as const;
const cand = (code: string, over: Partial<AuthorityCandidate> = {}): AuthorityCandidate => ({
  id: code,
  code,
  requiredPositionTypeId: 'EE',
  routingScope: 'PROJECT_JURISDICTION',
  priority: 100,
  hasDepartment: true,
  hasProjectType: true,
  hasJurisdictionType: false,
  hasCostBand: true,
  hasConditions: false,
  conditionsResult: 'MATCH',
  ruleVersionId: `rv-${code}`,
  ruleCode: `R-${code}`,
  rule: { ...okRule },
  ...over,
});
const at = '2026-09-20';

describe('selectAuthorityRule', () => {
  it('no candidates => NO_RULE (the real R&B case)', () => {
    expect(selectAuthorityRule([], at).status).toBe('NO_RULE');
  });

  it('a candidate whose rule version is not executable is excluded, never used', () => {
    const c = cand('A', { rule: { ...okRule, enforcement_mode: 'ADVISORY_ONLY' } });
    const s = selectAuthorityRule([c], at);
    expect(s.status).toBe('NO_RULE');
    expect(s.considered[0]).toMatchObject({ excluded: 'RULE_VERSION_NOT_EXECUTABLE' });
    expect(selectAuthorityRule([cand('B', { rule: { ...okRule, verification_status: 'UNVERIFIED' } })], at).status).toBe('NO_RULE');
    expect(selectAuthorityRule([cand('C', { rule: { ...okRule, effective_to: '2020-01-01' } })], at).status).toBe('NO_RULE');
  });

  it('a single executable candidate is SELECTED', () => {
    const s = selectAuthorityRule([cand('A')], at);
    expect(s.status).toBe('SELECTED');
    if (s.status === 'SELECTED') expect(s.candidate.code).toBe('A');
  });

  it('picks the more specific rule over a generic one', () => {
    const generic = cand('G', { hasProjectType: false, hasCostBand: false, requiredPositionTypeId: 'SE' });
    const specific = cand('S', { requiredPositionTypeId: 'EE' });
    const s = selectAuthorityRule([generic, specific], at);
    expect(s.status === 'SELECTED' && s.candidate.code).toBe('S');
  });

  it('breaks specificity ties by lower priority number', () => {
    const a = cand('A', { priority: 200, requiredPositionTypeId: 'SE' });
    const b = cand('B', { priority: 50, requiredPositionTypeId: 'EE' });
    const s = selectAuthorityRule([a, b], at);
    expect(s.status === 'SELECTED' && s.candidate.code).toBe('B');
  });

  it('equally specific rules that disagree on the outcome are AMBIGUOUS', () => {
    const s = selectAuthorityRule([cand('A', { requiredPositionTypeId: 'EE' }), cand('B', { requiredPositionTypeId: 'SE' })], at);
    expect(s.status).toBe('AMBIGUOUS');
  });

  it('equally specific rules that agree are not ambiguous', () => {
    const s = selectAuthorityRule([cand('A'), cand('B')], at);
    expect(s.status).toBe('SELECTED');
  });

  it('unknown facts in a rule condition => CONDITION_UNKNOWN (cannot route without a human), not a guess', () => {
    const s = selectAuthorityRule([cand('A', { hasConditions: true, conditionsResult: 'INDETERMINATE' })], at);
    expect(s.status).toBe('CONDITION_UNKNOWN');
  });

  it('a rule whose conditions are not met is excluded', () => {
    const s = selectAuthorityRule([cand('A', { hasConditions: true, conditionsResult: 'NO_MATCH' })], at);
    expect(s.status).toBe('NO_RULE');
    expect(s.considered[0]!.excluded).toBe('CONDITIONS_NOT_MET');
  });
});

describe('decideHolder', () => {
  const seat = (id: string, holders: { userId: string; assignmentType?: string }[] = []) => ({
    positionId: id,
    positionCode: id,
    holders: holders.map((h) => ({ userId: h.userId, displayName: h.userId, assignmentType: h.assignmentType ?? 'PRIMARY' })),
  });
  const level = (officeId: string, seats: ReturnType<typeof seat>[]) => ({ officeId, officeName: officeId, seats });

  it('no seat anywhere => UNRESOLVED', () => {
    expect(decideHolder([level('div', []), level('dist', [])]).status).toBe('UNRESOLVED');
    expect(decideHolder([]).status).toBe('UNRESOLVED');
  });

  it('resolves the holder of the nearest level that has the seat type', () => {
    const d = decideHolder([level('div', []), level('dist', [seat('SE-1', [{ userId: 'u-se' }])])]);
    expect(d).toMatchObject({ status: 'RESOLVED', officeId: 'dist', positionId: 'SE-1', userId: 'u-se' });
  });

  it('never skips a vacant nearer seat to reach a farther holder', () => {
    const d = decideHolder([level('div', [seat('EE-vacant')]), level('dist', [seat('EE-2', [{ userId: 'u' }])])]);
    expect(d).toMatchObject({ status: 'INACTIVE_POSITION', positionId: 'EE-vacant' });
  });

  it('two seats of the required type at the nearest level => AMBIGUOUS', () => {
    const d = decideHolder([level('div', [seat('EE-1', [{ userId: 'a' }]), seat('EE-2', [{ userId: 'b' }])])]);
    expect(d).toMatchObject({ status: 'AMBIGUOUS', officeId: 'div' });
  });

  it('prefers the PRIMARY holder over acting/additional charge', () => {
    const d = decideHolder([level('div', [seat('EE-1', [{ userId: 'acting', assignmentType: 'ACTING' }, { userId: 'primary' }])])]);
    expect(d).toMatchObject({ status: 'RESOLVED', userId: 'primary' });
  });

  it('a transfer changes the holder without changing the seat (position, not person)', () => {
    const before = decideHolder([level('div', [seat('EE-1', [{ userId: 'A' }])])]);
    const after = decideHolder([level('div', [seat('EE-1', [{ userId: 'B' }])])]);
    expect(before).toMatchObject({ positionId: 'EE-1', userId: 'A' });
    expect(after).toMatchObject({ positionId: 'EE-1', userId: 'B' });
  });
});
