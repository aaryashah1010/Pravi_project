import { useState, useRef } from 'react';
import type { ProjectDetailDto, AiAnswerDto } from '@infraflow/shared';
import { useAskAi, useAiStatus, type AiEndpoint } from '@/lib/queries';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge, CodeTag } from '@/components/ui/Badge';
import { EmptyState, ErrorNotice, InfoBanner, Spinner } from '@/components/ui/States';
import { humanize } from '@/lib/format';
import type { Tone } from '@/lib/labels';

const QUICK_ACTIONS: { endpoint: AiEndpoint; label: string; icon: string; description: string }[] = [
  { endpoint: 'explain-blocker', label: 'Explain blockers', icon: 'block', description: 'Why is this project blocked and what is the root cause?' },
  { endpoint: 'next-actions', label: 'Next actions', icon: 'playlist_play', description: 'What should happen next to move this project forward?' },
  { endpoint: 'missing-documents', label: 'Missing documents', icon: 'folder_off', description: 'Which required documents are still missing?' },
  { endpoint: 'summarize', label: 'Summarize', icon: 'summarize', description: "Give a concise summary of this project's status." },
];

function confidenceTone(c: string): Tone {
  switch (c) {
    case 'high': return 'emerald';
    case 'medium': return 'amber';
    default: return 'rose';
  }
}

function SuggestionCard({ s }: { s: { type: string; title: string; rationale: string } }) {
  const iconMap: Record<string, string> = {
    NEXT_ACTION: 'arrow_forward',
    BLOCKER: 'block',
    PARALLEL_WORK: 'call_split',
    DOCUMENT_GAP: 'folder_off',
    RULE_EXPLANATION: 'gavel',
    INCONSISTENCY: 'warning',
    ESCALATION_REVIEW: 'supervisor_account',
  };
  return (
    <div className="flex gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3">
      <Icon name={iconMap[s.type] ?? 'lightbulb'} className="mt-0.5 shrink-0 text-[20px] text-secondary" />
      <div>
        <div className="text-label-lg text-on-surface">{s.title}</div>
        <p className="mt-0.5 text-body-sm text-on-surface-variant">{s.rationale}</p>
      </div>
    </div>
  );
}

function AnswerPanel({ answer }: { answer: AiAnswerDto }) {
  return (
    <div className="space-y-4">
      {/* Answer */}
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4">
        <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <Icon name="smart_toy" className="text-[16px] text-secondary" />
          AI Analysis
          <Badge tone={confidenceTone(answer.confidence)} label={`${answer.confidence} confidence`} />
          <span className="ml-auto text-body-sm text-outline">{answer.latencyMs}ms · {answer.provider}/{answer.model}</span>
        </div>
        <div className="mt-2 whitespace-pre-line text-body-md text-on-surface leading-relaxed">{answer.answer}</div>
      </div>

      {/* Suggestions */}
      {answer.suggestions.length > 0 ? (
        <div>
          <h3 className="mb-2 text-label-lg text-on-surface-variant">Suggestions</h3>
          <div className="space-y-2">
            {answer.suggestions.map((s, i) => <SuggestionCard key={i} s={s} />)}
          </div>
        </div>
      ) : null}

      {/* Rules cited */}
      {answer.rulesUsed.length > 0 ? (
        <div>
          <h3 className="mb-2 text-label-lg text-on-surface-variant">Rules cited</h3>
          <div className="space-y-1">
            {answer.rulesUsed.map((r) => (
              <div key={r.ruleCode} className="flex items-start gap-2 rounded bg-surface-container px-3 py-2 text-body-sm">
                <Icon name="gavel" className="mt-0.5 text-[14px] text-secondary" />
                <div>
                  <span className="font-medium"><CodeTag>{r.ruleCode}</CodeTag> {r.name}</span>
                  <div className="text-on-surface-variant">{r.sourceTitle}{r.citation ? ` · ${r.citation}` : ''}</div>
                  <Badge tone={r.trustBadge === 'VERIFIED_SOURCE' ? 'emerald' : r.trustBadge === 'SYNTHETIC_DEMO' ? 'amber' : 'slate'} label={humanize(r.trustBadge)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Facts used */}
      {answer.factsUsed.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-label-md text-on-surface-variant hover:text-on-surface">
            <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span> Facts used ({answer.factsUsed.length})
          </summary>
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-body-sm text-on-surface-variant">
            {answer.factsUsed.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </details>
      ) : null}

      {/* Guardrail notes */}
      {answer.notes.length > 0 ? (
        <InfoBanner tone="amber" icon="shield">
          {answer.notes.map((n, i) => <div key={i}>{n}</div>)}
        </InfoBanner>
      ) : null}

      {/* Disclaimer */}
      <div className="rounded border border-amber-200 bg-amber-50/50 px-3 py-2 text-body-sm text-amber-800">
        <Icon name="info" className="mr-1 align-[-3px] text-[14px]" />
        {answer.disclaimer}
      </div>
    </div>
  );
}

export function CopilotTab({ project }: { project: ProjectDetailDto }) {
  const status = useAiStatus();
  const ask = useAskAi();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AiAnswerDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doAsk = (endpoint: AiEndpoint, q?: string) => {
    setAnswer(null);
    ask.mutate(
      { endpoint, projectId: project.id, question: q },
      { onSuccess: (data) => setAnswer(data) },
    );
  };

  const handleCustomQuestion = () => {
    if (!question.trim()) return;
    doAsk('ask', question.trim());
    setQuestion('');
  };

  return (
    <div className="space-y-4">
      <InfoBanner tone="blue" icon="smart_toy">
        <strong>AI Copilot</strong> — advisory analysis of this project based on verified rules and current state.
        AI suggestions are advisory only; official decisions remain with authorized users.
        {status.data ? (
          <span className="ml-2 text-body-sm">
            Provider: {status.data.provider}/{status.data.model} · {status.data.configured ? 'Online' : 'Deterministic fallback'}
          </span>
        ) : null}
      </InfoBanner>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.endpoint}
            type="button"
            onClick={() => doAsk(a.endpoint)}
            disabled={ask.isPending}
            className="group rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3 text-left transition-all hover:border-secondary hover:shadow-md disabled:opacity-50"
          >
            <Icon name={a.icon} className="text-[24px] text-secondary group-hover:text-primary" />
            <div className="mt-1 text-label-lg text-on-surface">{a.label}</div>
            <p className="mt-0.5 text-body-sm text-on-surface-variant">{a.description}</p>
          </button>
        ))}
      </div>

      {/* Custom question */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCustomQuestion()}
          placeholder="Ask anything about this project…"
          className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-body-md transition-colors focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
          disabled={ask.isPending}
        />
        <Button variant="primary" icon="send" loading={ask.isPending} disabled={!question.trim()} onClick={handleCustomQuestion}>Ask</Button>
      </div>

      {/* Loading */}
      {ask.isPending ? (
        <div className="flex items-center justify-center py-12">
          <Spinner label="Analyzing project against verified rules…" />
        </div>
      ) : null}

      {/* Error */}
      {ask.isError ? <ErrorNotice error={ask.error} /> : null}

      {/* Answer */}
      {answer ? <AnswerPanel answer={answer} /> : null}

      {/* Empty state when no answer yet */}
      {!answer && !ask.isPending && !ask.isError ? (
        <EmptyState
          icon="smart_toy"
          title="Ask the copilot"
          message="Use a quick action above or type a question to analyze this project's workflow, blockers, and compliance."
        />
      ) : null}
    </div>
  );
}
