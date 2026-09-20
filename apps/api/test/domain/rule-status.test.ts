import { describe, expect, it } from 'vitest';
import { deriveTrustBadge, isExecutable, type RuleVersionLike } from '../../src/modules/rules/domain/rule-status.js';

const base: RuleVersionLike = {
  enforcement_mode: 'ENFORCEABLE',
  verification_status: 'VERIFIED',
  effective_from: null,
  effective_to: null,
  scope: {},
  conditions: {},
  action: {},
};

describe('isExecutable', () => {
  it('is true only for ENFORCEABLE + VERIFIED within the effective window', () => {
    expect(isExecutable(base, '2026-09-20')).toBe(true);
  });
  it('is false for advisory or non-enforceable rules', () => {
    expect(isExecutable({ ...base, enforcement_mode: 'ADVISORY_ONLY' }, '2026-09-20')).toBe(false);
    expect(isExecutable({ ...base, enforcement_mode: 'NON_ENFORCEABLE' }, '2026-09-20')).toBe(false);
  });
  it('is false for any non-VERIFIED status', () => {
    for (const s of ['DRAFT', 'UNVERIFIED', 'SUPERSEDED', 'DISABLED'] as const) {
      expect(isExecutable({ ...base, verification_status: s }, '2026-09-20')).toBe(false);
    }
  });
  it('respects effective_from / effective_to (inclusive)', () => {
    expect(isExecutable({ ...base, effective_from: '2026-09-21' }, '2026-09-20')).toBe(false);
    expect(isExecutable({ ...base, effective_from: '2026-09-20' }, '2026-09-20')).toBe(true);
    expect(isExecutable({ ...base, effective_to: '2026-09-19' }, '2026-09-20')).toBe(false);
    expect(isExecutable({ ...base, effective_to: '2026-09-20' }, '2026-09-20')).toBe(true);
  });
  it('accepts a Date', () => {
    expect(isExecutable({ ...base, effective_from: '2026-01-01' }, new Date('2026-09-20T10:00:00Z'))).toBe(true);
  });
});

describe('deriveTrustBadge', () => {
  it('synthetic rules never look verified', () => {
    expect(deriveTrustBadge({ ...base, scope: { synthetic: true } })).toBe('SYNTHETIC_DEMO');
  });
  it('plain enforceable verified rule is VERIFIED_SOURCE', () => {
    expect(deriveTrustBadge(base)).toBe('VERIFIED_SOURCE');
  });
  it('conditional scope shows CONDITIONAL', () => {
    expect(deriveTrustBadge({ ...base, scope: { conditional: true } })).toBe('CONDITIONAL');
  });
  it('currency-check advisory rules show CURRENCY_CHECK_REQUIRED', () => {
    expect(deriveTrustBadge({ ...base, enforcement_mode: 'ADVISORY_ONLY', action: { currency_check_required: true } })).toBe('CURRENCY_CHECK_REQUIRED');
  });
  it('contract-specific scope wins over advisory', () => {
    expect(deriveTrustBadge({ ...base, enforcement_mode: 'ADVISORY_ONLY', scope: { contractSpecific: true } })).toBe('CONTRACT_SPECIFIC');
  });
  it('unverified is NOT_VERIFIED and superseded is SUPERSEDED', () => {
    expect(deriveTrustBadge({ ...base, enforcement_mode: 'ADVISORY_ONLY', verification_status: 'UNVERIFIED' })).toBe('NOT_VERIFIED');
    expect(deriveTrustBadge({ ...base, verification_status: 'SUPERSEDED' })).toBe('SUPERSEDED');
  });
  it('a verified+enforceable rule outside its effective window is NOT_VERIFIED, not VERIFIED_SOURCE', () => {
    expect(deriveTrustBadge({ ...base, effective_to: '2020-01-01' }, '2026-09-20')).toBe('NOT_VERIFIED');
  });
});
