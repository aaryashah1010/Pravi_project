// AI guardrails (pure). The model's output is UNTRUSTED: it is validated against the context we supplied.
// Rules of the road (docs 14/39): cite only supplied rules, never invent clauses, never claim an official action,
// always require human review. Anything removed is reported in `notes` so the UI can show it.
import type { AiContext, AiRawAnswer } from '../ai.types.js';

export interface GuardedAnswer extends AiRawAnswer {
  notes: string[];
}

const RULE_CODE = /\b(?:RNB|WRD|DEMO)-[A-Z]{2,5}(?:-[A-Z0-9]+)*\b|\bRULE-\d{3}\b/g;
const SECTION_REF = /\b(?:Section|Clause|Sec\.|Para(?:graph)?|Article|Rule)\s+\d+(?:\.\d+)*(?:\([a-z]\))?/gi;
const OFFICIAL_VERB = /\b(?:approved|rejected|waived|sanctioned|overridden|overrode|granted|released|certified)\b/i;
const FIRST_PERSON = /\b(?:i|we|i've|we've|i'll|we'll)\b/i;
const AI_ACTOR = /\bby (?:the )?(?:ai|assistant|copilot|system)\b/i;

export function guardAnswer(raw: AiRawAnswer, ctx: AiContext): GuardedAnswer {
  const notes: string[] = [];
  const known = new Map(ctx.rules.map((r) => [r.ruleCode, r]));
  const knownSources = new Set(ctx.rules.map((r) => r.sourceCode));
  const allowedSections = ctx.rules.flatMap((r) => r.citations);

  const rulesUsed = [...new Set(raw.rulesUsed)].filter((c) => {
    const ok = known.has(c);
    if (!ok) notes.push(`Removed a rule reference that is not in the verified context: ${c}`);
    return ok;
  });
  const sources = [...new Set(raw.sources)].filter((c) => {
    const ok = knownSources.has(c);
    if (!ok) notes.push(`Removed a source reference that is not in the verified context: ${c}`);
    return ok;
  });

  const scrub = (text: string): string => {
    let out = text.replace(RULE_CODE, (m) => {
      if (known.has(m)) return m;
      notes.push(`Removed an unverified rule reference from the text: ${m}`);
      return '[unverified rule reference removed]';
    });
    out = out.replace(SECTION_REF, (m) => {
      if (allowedSections.some((c) => c.toLowerCase().includes(m.toLowerCase()))) return m;
      notes.push(`Removed an unverified clause reference from the text: ${m}`);
      return '[unverified clause reference removed]';
    });
    // Sentence-level: any first-person (or "by the AI") claim of an official action is replaced wholesale.
    out = out
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => {
        if (OFFICIAL_VERB.test(sentence) && (FIRST_PERSON.test(sentence) || AI_ACTOR.test(sentence))) {
          notes.push('Removed a statement implying the AI took an official action.');
          return 'Official decisions are for an authorized user to make.';
        }
        return sentence;
      })
      .join(' ');
    return out;
  };

  const answer = scrub(raw.answer);
  const suggestions = raw.suggestions.map((s) => ({ ...s, title: scrub(s.title), rationale: scrub(s.rationale) }));
  const factsUsed = raw.factsUsed.map(scrub);

  // Anything we had to remove lowers our confidence in the rest of the answer.
  const confidence = notes.length && raw.confidence === 'high' ? 'medium' : raw.confidence;
  return { answer, factsUsed, rulesUsed, sources, confidence, suggestions, notes: [...new Set(notes)] };
}
