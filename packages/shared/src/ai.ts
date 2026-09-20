import { z } from 'zod';

export const AI_DISCLAIMER = 'AI suggestions are advisory. Official decisions remain with authorized users.';

export const AiAskSchema = z.object({ projectId: z.string().uuid(), question: z.string().trim().min(3).max(500) });
export const AiProjectSchema = z.object({ projectId: z.string().uuid() });
export const AiNodeSchema = z.object({ projectId: z.string().uuid(), nodeCode: z.string().min(1).max(60) });

export type AiMode = 'EXPLAIN_BLOCKER' | 'NEXT_ACTIONS' | 'WHY_REQUIRED' | 'MISSING_DOCUMENTS' | 'SUMMARIZE' | 'ASK';

export type AiSuggestionType =
  | 'NEXT_ACTION' | 'BLOCKER' | 'PARALLEL_WORK' | 'DOCUMENT_GAP' | 'RULE_EXPLANATION' | 'INCONSISTENCY' | 'ESCALATION_REVIEW';

export interface AiSuggestionDto {
  type: AiSuggestionType;
  title: string;
  rationale: string;
}

export interface AiAnswerDto {
  runId: string;
  mode: AiMode;
  answer: string;
  factsUsed: string[];
  /** Rule codes actually present in the context supplied to the model (validated server-side). */
  rulesUsed: { ruleCode: string; name: string; trustBadge: string; sourceTitle: string; citation: string }[];
  sources: { code: string; title: string }[];
  confidence: 'high' | 'medium' | 'low';
  suggestions: AiSuggestionDto[];
  /** Always true: AI never exercises statutory/administrative authority. */
  requiresHumanReview: true;
  provider: 'openai' | 'deterministic';
  model: string;
  /** Guardrail/fallback notes shown to the user (e.g. an uncited rule reference was removed). */
  notes: string[];
  disclaimer: string;
  latencyMs: number;
  createdAt: string;
}

export interface AiStatusDto {
  provider: 'openai' | 'deterministic';
  model: string;
  configured: boolean;
  disclaimer: string;
}
