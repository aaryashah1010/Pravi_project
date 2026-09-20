// Rule condition DSL (pure: no HTTP/DB). Stored as JSONB in rule_versions.conditions / node activation_condition.
//
//   {}                                              -> unconditional (MATCH)
//   { "fact": "attributes.x", "op": "eq", "value": true }
//   { "all": [ ...conditions ] } | { "any": [ ... ] } | { "not": { ... } }
//
// Three-valued (Kleene) logic: a missing fact yields INDETERMINATE, never a silent NO_MATCH.
// INDETERMINATE means "a human must supply/verify a fact", which the engine surfaces instead of guessing.

export type Tri = 'MATCH' | 'NO_MATCH' | 'INDETERMINATE';

export const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'exists'] as const;
export type Op = (typeof OPS)[number];

export interface LeafTrace {
  fact: string;
  op: Op;
  expected: unknown;
  actual: unknown;
  result: Tri;
}

export interface Evaluation {
  result: Tri;
  leaves: LeafTrace[];
  /** Fact paths that were missing and therefore made a leaf INDETERMINATE. */
  missingFacts: string[];
}

export class ConditionError extends Error {}

export type Facts = Record<string, unknown>;

export function getFact(facts: Facts, path: string): unknown {
  let cur: unknown = facts;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const isMissing = (v: unknown) => v === undefined || v === null || v === '';

function toComparable(v: unknown): number | string | boolean {
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return String(v);
}

function evalLeaf(node: Record<string, unknown>, facts: Facts, out: Evaluation): Tri {
  const fact = node.fact;
  const op = node.op as Op;
  if (typeof fact !== 'string' || !fact) throw new ConditionError('Leaf condition requires a "fact" path');
  if (!OPS.includes(op)) throw new ConditionError(`Unknown operator "${String(node.op)}"`);
  const actual = getFact(facts, fact);
  const expected = node.value;
  let result: Tri;

  if (op === 'exists') {
    const want = expected === undefined ? true : Boolean(expected);
    result = isMissing(actual) === !want ? 'MATCH' : 'NO_MATCH';
  } else if (isMissing(actual)) {
    result = 'INDETERMINATE';
    out.missingFacts.push(fact);
  } else if (op === 'in') {
    if (!Array.isArray(expected)) throw new ConditionError('"in" requires an array value');
    result = expected.map(toComparable).includes(toComparable(actual)) ? 'MATCH' : 'NO_MATCH';
  } else {
    const a = toComparable(actual);
    const b = toComparable(expected);
    let ok: boolean;
    switch (op) {
      case 'eq':
        ok = a === b;
        break;
      case 'neq':
        ok = a !== b;
        break;
      default: {
        if (typeof a !== 'number' || typeof b !== 'number') {
          throw new ConditionError(`Operator "${op}" requires numeric operands (fact ${fact})`);
        }
        ok = op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
      }
    }
    result = ok ? 'MATCH' : 'NO_MATCH';
  }
  out.leaves.push({ fact, op, expected, actual: actual ?? null, result });
  return result;
}

function walk(cond: unknown, facts: Facts, out: Evaluation): Tri {
  if (cond === null || cond === undefined) return 'MATCH';
  if (typeof cond !== 'object' || Array.isArray(cond)) throw new ConditionError('Condition must be an object');
  const node = cond as Record<string, unknown>;
  const keys = Object.keys(node);
  if (keys.length === 0) return 'MATCH';

  if ('all' in node) {
    if (!Array.isArray(node.all)) throw new ConditionError('"all" requires an array');
    const rs = node.all.map((c) => walk(c, facts, out));
    return rs.includes('NO_MATCH') ? 'NO_MATCH' : rs.includes('INDETERMINATE') ? 'INDETERMINATE' : 'MATCH';
  }
  if ('any' in node) {
    if (!Array.isArray(node.any)) throw new ConditionError('"any" requires an array');
    const rs = node.any.map((c) => walk(c, facts, out));
    return rs.includes('MATCH') ? 'MATCH' : rs.includes('INDETERMINATE') ? 'INDETERMINATE' : 'NO_MATCH';
  }
  if ('not' in node) {
    const r = walk(node.not, facts, out);
    return r === 'MATCH' ? 'NO_MATCH' : r === 'NO_MATCH' ? 'MATCH' : 'INDETERMINATE';
  }
  return evalLeaf(node, facts, out);
}

/** Evaluate a condition against facts. Throws ConditionError for a malformed condition. */
export function evaluateCondition(cond: unknown, facts: Facts): Evaluation {
  const out: Evaluation = { result: 'MATCH', leaves: [], missingFacts: [] };
  out.result = walk(cond, facts, out);
  out.missingFacts = [...new Set(out.missingFacts)];
  return out;
}

/** Non-throwing variant: malformed conditions become an explicit ERROR the caller must treat as "needs human review". */
export function safeEvaluate(cond: unknown, facts: Facts): Evaluation & { error?: string } {
  try {
    return evaluateCondition(cond, facts);
  } catch (e) {
    return { result: 'INDETERMINATE', leaves: [], missingFacts: [], error: (e as Error).message };
  }
}
