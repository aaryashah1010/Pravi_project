import { Link, useParams } from 'react-router-dom';
import { useApproval } from '@/lib/queries';
import { Page } from '@/components/shell/AppShell';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { LinkButton } from '@/components/ui/Button';
import { ApprovalPanel } from './ApprovalPanel';

export function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useApproval(id);

  return (
    <Page className="max-w-5xl">
      <Link to="/approvals" className="inline-flex items-center gap-1 text-body-md text-secondary hover:underline">
        <Icon name="arrow_back" className="text-[16px]" />
        All approvals
      </Link>
      {q.isLoading ? (
        <SkeletonRows rows={8} />
      ) : q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
      ) : q.data ? (
        <ApprovalPanel approval={q.data} />
      ) : (
        <EmptyState icon="search_off" title="Approval not found" action={<LinkButton to="/approvals">Back to approvals</LinkButton>} />
      )}
    </Page>
  );
}
