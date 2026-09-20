import type { AiMode, AiSuggestionType, BlockerDto } from '@infraflow/shared';

/** Everything the model may see. Built deterministically from permission-filtered project state; nothing else is sent. */
export interface AiContext {
  generatedAt: string;
  project: { code: string; name: string; stage: string; status: string; estimatedCost: string; department: string; location: string | null };
  workflowSummary: { total: number; completed: number; eligible: number; active: number; blocked: number; notApplicable: number; pendingVerification: number };
  nodes: {
    code: string;
    name: string;
    type: string;
    state: string;
    gateKind: string;
    ruleCode: string | null;
    owner: string | null;
    ageDays: number | null;
    slaDays: number | null;
    overdue: boolean;
    pendingFacts: string[];
    missingDocuments: string[];
    openBlockingIssues: number;
  }[];
  gatingEdges: { from: string; to: string }[];
  blockers: BlockerDto[];
  parallelEligible: { nodeCode: string; name: string }[];
  approvals: { nodeCode: string; type: string; status: string; decidingPosition: string | null; resolution: string | null; syntheticAuthority: boolean }[];
  openIssues: { title: string; severity: string; category: string; ageDays: number; blocks: string[] }[];
  /** Only rules linked to this project's workflow/approvals. The model may cite nothing else. */
  rules: { ruleCode: string; name: string; statement: string | null; trustBadge: string; executable: boolean; synthetic: boolean; sourceCode: string; sourceTitle: string; citations: string[] }[];
  recentActivity: { action: string; at: string; actor: string | null }[];
}

export interface AiRequest {
  mode: AiMode;
  context: AiContext;
  question?: string;
  nodeCode?: string;
}

export interface AiRawAnswer {
  answer: string;
  factsUsed: string[];
  rulesUsed: string[];
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  suggestions: { type: AiSuggestionType; title: string; rationale: string }[];
}

export interface AiProvider {
  readonly name: 'openai' | 'deterministic';
  readonly model: string;
  complete(req: AiRequest): Promise<AiRawAnswer>;
}
