import { AI_DISCLAIMER, type AiAnswerDto, type AiMode } from '@infraflow/shared';
import { type Db, withTx } from '../../platform/db.js';
import type { RequestContext } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { buildContext } from './ai.context.js';
import type { AiProvider, AiRawAnswer } from './ai.types.js';
import { guardAnswer } from './domain/guardrails.js';

const DB_MODE: Record<AiMode, string> = {
  EXPLAIN_BLOCKER: 'EXPLAIN', WHY_REQUIRED: 'EXPLAIN', ASK: 'EXPLAIN', NEXT_ACTIONS: 'RECOMMEND', MISSING_DOCUMENTS: 'DETECT', SUMMARIZE: 'SUMMARIZE',
};

export interface AiRuntime {
  provider: AiProvider;
  fallback: AiProvider;
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`AI provider timed out after ${ms} ms`)), ms + 500))]);

/**
 * Build verified context -> ask the provider (falls back to the deterministic provider on any failure) -> validate the answer
 * against the context -> persist run/citations/suggestions. There is NO write path from here into approvals, workflow or rules.
 */
export async function runAi(
  db: Db,
  ctx: RequestContext,
  rt: AiRuntime,
  timeoutMs: number,
  input: { mode: AiMode; projectId: string; question?: string; nodeCode?: string },
): Promise<AiAnswerDto> {
  const { context, ruleIds } = await buildContext(db, ctx, input.projectId);
  const req = { mode: input.mode, context, question: input.question, nodeCode: input.nodeCode };
  const started = Date.now();

  const notes: string[] = [];
  let used: AiProvider = rt.provider;
  let raw: AiRawAnswer;
  try {
    raw = await withTimeout(rt.provider.complete(req), timeoutMs);
  } catch (e) {
    if (rt.provider.name !== 'deterministic') {
      notes.push(`The AI provider was unavailable (${(e as Error).message.slice(0, 120)}); a rule-based summary is shown instead.`);
    }
    used = rt.fallback;
    raw = await rt.fallback.complete(req);
  }

  const guarded = guardAnswer(raw, context);
  notes.push(...guarded.notes);
  const latencyMs = Date.now() - started;

  const runId = await withTx(db, async (tx) => {
    const run = await tx.query<{ id: string }>(
      `INSERT INTO ai_runs (project_id, requested_by, mode, model_provider, model_name, input_context, output, status, started_at, completed_at, latency_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'COMPLETED',$8,$8,$9) RETURNING id`,
      [
        input.projectId, ctx.actor!.userId, DB_MODE[input.mode], used.name, used.model,
        JSON.stringify({ mode: input.mode, question: input.question ?? null, nodeCode: input.nodeCode ?? null, context }),
        JSON.stringify({ ...guarded, notes }), ctx.now, latencyMs,
      ],
    );
    const id = run.rows[0]!.id;
    for (const code of guarded.rulesUsed) {
      const ids = ruleIds.get(code);
      if (ids) await tx.query(`INSERT INTO ai_citations (ai_run_id, citation_type, rule_version_id, source_id, locator, created_at) VALUES ($1,'RULE',$2,$3,$4,$5)`,
        [id, ids.ruleVersionId, ids.sourceId, context.rules.find((r) => r.ruleCode === code)?.citations[0] ?? null, ctx.now]);
    }
    for (const s of guarded.suggestions) {
      await tx.query(
        `INSERT INTO ai_suggestions (ai_run_id, project_id, suggestion_type, title, rationale, confidence, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,'SUGGESTED',$7)`,
        [id, input.projectId, s.type, s.title.slice(0, 200), s.rationale, guarded.confidence.toUpperCase(), ctx.now],
      );
    }
    await audit(tx, ctx, {
      action: 'ai.run', entityType: 'ai_run', entityId: id, projectId: input.projectId,
      metadata: { mode: input.mode, provider: used.name, model: used.model, guardrailNotes: notes.length, rulesCited: guarded.rulesUsed },
    });
    return id;
  });

  return {
    runId,
    mode: input.mode,
    answer: guarded.answer,
    factsUsed: guarded.factsUsed,
    rulesUsed: guarded.rulesUsed.map((code) => {
      const r = context.rules.find((x) => x.ruleCode === code)!;
      return { ruleCode: r.ruleCode, name: r.name, trustBadge: r.trustBadge, sourceTitle: r.sourceTitle, citation: r.citations[0] ?? 'Citation locator to be captured' };
    }),
    sources: guarded.sources.map((code) => ({ code, title: context.rules.find((r) => r.sourceCode === code)?.sourceTitle ?? code })),
    confidence: guarded.confidence,
    suggestions: guarded.suggestions,
    requiresHumanReview: true,
    provider: used.name,
    model: used.model,
    notes: [...new Set(notes)],
    disclaimer: AI_DISCLAIMER,
    latencyMs,
    createdAt: ctx.now.toISOString(),
  };
}

export async function listRuns(db: Db, ctx: RequestContext, projectId: string) {
  const r = await db.query(
    `SELECT r.id, r.mode, r.model_provider, r.model_name, r.latency_ms, r.started_at, r.output->>'answer' AS answer, u.display_name AS requested_by
       FROM ai_runs r JOIN app_users u ON u.id = r.requested_by JOIN projects p ON p.id = r.project_id
      WHERE r.project_id = $1 AND r.requested_by = $2 ORDER BY r.started_at DESC LIMIT 20`,
    [projectId, ctx.actor!.userId],
  );
  return r.rows.map((x) => ({ id: x.id, mode: x.mode, provider: x.model_provider, model: x.model_name, latencyMs: x.latency_ms, at: x.started_at.toISOString(), answer: x.answer, requestedBy: x.requested_by }));
}
