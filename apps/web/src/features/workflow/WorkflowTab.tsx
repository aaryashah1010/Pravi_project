import { useSearchParams } from 'react-router-dom';
import type { ProjectDetailDto } from '@infraflow/shared';
import { useBlockers, useWorkflow } from '@/lib/queries';
import { ErrorNotice, InfoBanner, Skeleton } from '@/components/ui/States';
import { WorkflowGraph } from './WorkflowGraph';

export function WorkflowTab({ project }: { project: ProjectDetailDto }) {
  const [sp, setSp] = useSearchParams();
  const wf = useWorkflow(project.id, project.hasWorkflow);
  const blockers = useBlockers(project.id, project.hasWorkflow);

  const select = (code: string | null) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (code) n.set('node', code);
        else n.delete('node');
        return n;
      },
      { replace: true },
    );

  if (wf.isLoading) return <Skeleton className="h-[520px] w-full" />;
  if (wf.isError) return <ErrorNotice error={wf.error} onRetry={() => wf.refetch()} />;
  if (!wf.data) return null;

  return (
    <div className="space-y-3">
      {blockers.data?.headline ? (
        <InfoBanner tone="rose" icon="report">
          {blockers.data.headline}
        </InfoBanner>
      ) : null}
      <WorkflowGraph wf={wf.data} blockers={blockers.data} selectedCode={sp.get('node')} onSelect={select} projectId={project.id} />
      <p className="text-body-sm text-on-surface-variant">
        Template <span className="font-code-sm">{wf.data.templateCode} v{wf.data.templateVersion}</span> · generated from the rule versions frozen at submission. Step timings are configured SLAs (operational targets), not statutory limits.
      </p>
    </div>
  );
}
