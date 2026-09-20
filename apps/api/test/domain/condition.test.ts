import { describe, expect, it } from 'vitest';
import { ConditionError, evaluateCondition, getFact, safeEvaluate } from '../../src/modules/rules/domain/condition.js';

const facts = {
  project: { estimated_cost: 120000000, project_type: 'GOV_BUILDING' },
  attributes: { local_body_approval_required: true, floors: '3', empty: '' },
  site: { possession_status: 'PENDING' },
};

describe('getFact', () => {
  it('resolves dotted paths and returns undefined for missing ones', () => {
    expect(getFact(facts, 'project.estimated_cost')).toBe(120000000);
    expect(getFact(facts, 'attributes.nope')).toBeUndefined();
    expect(getFact(facts, 'nope.deeper.still')).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  it('empty condition is unconditional MATCH', () => {
    expect(evaluateCondition({}, facts).result).toBe('MATCH');
    expect(evaluateCondition(null, facts).result).toBe('MATCH');
  });

  it('eq / neq / in', () => {
    expect(evaluateCondition({ fact: 'attributes.local_body_approval_required', op: 'eq', value: true }, facts).result).toBe('MATCH');
    expect(evaluateCondition({ fact: 'attributes.local_body_approval_required', op: 'eq', value: false }, facts).result).toBe('NO_MATCH');
    expect(evaluateCondition({ fact: 'site.possession_status', op: 'neq', value: 'HANDED_OVER' }, facts).result).toBe('MATCH');
    expect(evaluateCondition({ fact: 'site.possession_status', op: 'in', value: ['PENDING', 'UNKNOWN'] }, facts).result).toBe('MATCH');
  });

  it('numeric comparisons coerce numeric strings (both sides)', () => {
    expect(evaluateCondition({ fact: 'project.estimated_cost', op: 'gt', value: '50000000' }, facts).result).toBe('MATCH');
    expect(evaluateCondition({ fact: 'attributes.floors', op: 'gte', value: 3 }, facts).result).toBe('MATCH');
    expect(evaluateCondition({ fact: 'project.estimated_cost', op: 'lte', value: 50000000 }, facts).result).toBe('NO_MATCH');
  });

  it('a missing fact is INDETERMINATE, never a silent NO_MATCH', () => {
    const r = evaluateCondition({ fact: 'attributes.requires_land_acquisition', op: 'eq', value: true }, facts);
    expect(r.result).toBe('INDETERMINATE');
    expect(r.missingFacts).toEqual(['attributes.requires_land_acquisition']);
  });

  it('an empty-string fact counts as missing', () => {
    expect(evaluateCondition({ fact: 'attributes.empty', op: 'eq', value: 'x' }, facts).result).toBe('INDETERMINATE');
  });

  it('exists is decidable on missing facts', () => {
    expect(evaluateCondition({ fact: 'attributes.nope', op: 'exists' }, facts).result).toBe('NO_MATCH');
    expect(evaluateCondition({ fact: 'attributes.nope', op: 'exists', value: false }, facts).result).toBe('MATCH');
    expect(evaluateCondition({ fact: 'attributes.floors', op: 'exists' }, facts).result).toBe('MATCH');
  });

  it('all: NO_MATCH dominates INDETERMINATE dominates MATCH (Kleene AND)', () => {
    const m = { fact: 'site.possession_status', op: 'eq', value: 'PENDING' };
    const n = { fact: 'site.possession_status', op: 'eq', value: 'HANDED_OVER' };
    const i = { fact: 'attributes.unknown', op: 'eq', value: 1 };
    expect(evaluateCondition({ all: [m, m] }, facts).result).toBe('MATCH');
    expect(evaluateCondition({ all: [m, i] }, facts).result).toBe('INDETERMINATE');
    expect(evaluateCondition({ all: [n, i] }, facts).result).toBe('NO_MATCH');
    expect(evaluateCondition({ all: [] }, facts).result).toBe('MATCH');
  });

  it('any: MATCH dominates INDETERMINATE dominates NO_MATCH (Kleene OR)', () => {
    const m = { fact: 'site.possession_status', op: 'eq', value: 'PENDING' };
    const n = { fact: 'site.possession_status', op: 'eq', value: 'HANDED_OVER' };
    const i = { fact: 'attributes.unknown', op: 'eq', value: 1 };
    expect(evaluateCondition({ any: [n, m] }, facts).result).toBe('MATCH');
    expect(evaluateCondition({ any: [n, i] }, facts).result).toBe('INDETERMINATE');
    expect(evaluateCondition({ any: [n, n] }, facts).result).toBe('NO_MATCH');
    expect(evaluateCondition({ any: [m, i] }, facts).result).toBe('MATCH');
  });

  it('not: flips MATCH/NO_MATCH and leaves INDETERMINATE alone', () => {
    expect(evaluateCondition({ not: { fact: 'site.possession_status', op: 'eq', value: 'PENDING' } }, facts).result).toBe('NO_MATCH');
    expect(evaluateCondition({ not: { fact: 'attributes.unknown', op: 'eq', value: 1 } }, facts).result).toBe('INDETERMINATE');
  });

  it('records a trace for every leaf evaluated', () => {
    const r = evaluateCondition({ all: [{ fact: 'project.estimated_cost', op: 'gt', value: 1 }, { fact: 'attributes.unknown', op: 'eq', value: 1 }] }, facts);
    expect(r.leaves).toHaveLength(2);
    expect(r.leaves[0]).toMatchObject({ fact: 'project.estimated_cost', result: 'MATCH', actual: 120000000 });
    expect(r.leaves[1]).toMatchObject({ result: 'INDETERMINATE', actual: null });
  });

  it('throws ConditionError for malformed conditions', () => {
    expect(() => evaluateCondition({ fact: 'a', op: 'like', value: 1 }, facts)).toThrow(ConditionError);
    expect(() => evaluateCondition({ op: 'eq', value: 1 }, facts)).toThrow(ConditionError);
    expect(() => evaluateCondition({ all: 'x' }, facts)).toThrow(ConditionError);
    expect(() => evaluateCondition({ fact: 'site.possession_status', op: 'gt', value: 1 }, facts)).toThrow(ConditionError);
    expect(() => evaluateCondition({ fact: 'a', op: 'in', value: 5 }, { a: 1 })).toThrow(ConditionError);
  });

  it('safeEvaluate turns malformed input into INDETERMINATE with an error, never MATCH', () => {
    const r = safeEvaluate({ fact: 'a', op: 'like', value: 1 }, facts);
    expect(r.result).toBe('INDETERMINATE');
    expect(r.error).toMatch(/Unknown operator/);
  });
});
