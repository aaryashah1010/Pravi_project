import { describe, expect, it } from 'vitest';
import type { AiContext, AiRawAnswer } from '../../src/modules/ai/ai.types.js';
import { guardAnswer } from '../../src/modules/ai/domain/guardrails.js';

const ctx = {
  rules: [
    { ruleCode: 'RULE-007', name: 'Land duly made over', statement: 's', trustBadge: 'VERIFIED_SOURCE', executable: true, synthetic: false, sourceCode: 'SRC-GJ-RNB-AUDIT', sourceTitle: 'Audit', citations: ['Locator to be captured'] },
    { ruleCode: 'RNB-WF-002', name: 'AA', statement: 's', trustBadge: 'VERIFIED_SOURCE', executable: true, synthetic: false, sourceCode: 'SRC-EWM-2020', sourceTitle: 'EWM', citations: ['Volume I, Section 3.2.2'] },
  ],
} as unknown as AiContext;

const raw = (over: Partial<AiRawAnswer> = {}): AiRawAnswer => ({
  answer: 'Site handover is pending.', factsUsed: [], rulesUsed: [], sources: [], confidence: 'high', suggestions: [], ...over,
});

describe('guardAnswer', () => {
  it('keeps rules and sources that are in the supplied context', () => {
    const g = guardAnswer(raw({ rulesUsed: ['RULE-007'], sources: ['SRC-GJ-RNB-AUDIT'], answer: 'RULE-007 requires land to be made over.' }), ctx);
    expect(g.rulesUsed).toEqual(['RULE-007']);
    expect(g.sources).toEqual(['SRC-GJ-RNB-AUDIT']);
    expect(g.answer).toBe('RULE-007 requires land to be made over.');
    expect(g.notes).toEqual([]);
    expect(g.confidence).toBe('high');
  });

  it('strips invented rule codes from the lists and from the prose, and reports it', () => {
    const g = guardAnswer(raw({ rulesUsed: ['RULE-007', 'RNB-XYZ-999'], answer: 'Under RNB-XYZ-999 and RULE-007 the work stops.' }), ctx);
    expect(g.rulesUsed).toEqual(['RULE-007']);
    expect(g.answer).toBe('Under [unverified rule reference removed] and RULE-007 the work stops.');
    expect(g.notes.length).toBeGreaterThanOrEqual(2);
    expect(g.confidence).toBe('medium');
  });

  it('removes fabricated clause numbers but keeps a section that appears in a supplied citation', () => {
    const g = guardAnswer(raw({ answer: 'See Section 3.2.2 and also Clause 18-B and Section 9.9.' }), ctx);
    expect(g.answer).toContain('Section 3.2.2');
    expect(g.answer).not.toContain('Section 9.9');
    expect(g.answer).toContain('[unverified clause reference removed]');
  });

  it('removes unknown sources', () => {
    const g = guardAnswer(raw({ sources: ['SRC-EWM-2020', 'SRC-MADE-UP'] }), ctx);
    expect(g.sources).toEqual(['SRC-EWM-2020']);
    expect(g.notes.join(' ')).toContain('SRC-MADE-UP');
  });

  it('neutralises statements implying the AI took an official action', () => {
    const g = guardAnswer(raw({ answer: 'I have approved the technical sanction and waived the requirement.' }), ctx);
    expect(g.answer).not.toMatch(/approved|waived/i);
    expect(g.notes.join(' ')).toContain('official action');
  });

  it('scrubs suggestions and facts as well', () => {
    const g = guardAnswer(
      raw({ suggestions: [{ type: 'NEXT_ACTION', title: 'Follow RULE-999', rationale: 'Because Section 12.4 says so' }], factsUsed: ['RULE-999 applies'] }),
      ctx,
    );
    expect(g.suggestions[0]!.title).toBe('Follow [unverified rule reference removed]');
    expect(g.suggestions[0]!.rationale).toContain('[unverified clause reference removed]');
    expect(g.factsUsed[0]).toContain('[unverified rule reference removed]');
  });

  it('does not lower a non-high confidence and leaves clean answers untouched', () => {
    expect(guardAnswer(raw({ confidence: 'low', rulesUsed: ['NOPE-AA-1'] }), ctx).confidence).toBe('low');
    expect(guardAnswer(raw({ answer: 'Nothing to flag.' }), ctx).notes).toEqual([]);
  });
});
