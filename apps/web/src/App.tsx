import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppShell } from '@/components/shell/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { Spinner, EmptyState } from '@/components/ui/States';
import { LinkButton } from '@/components/ui/Button';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProjectListPage } from '@/features/projects/ProjectListPage';
import { ProjectCreatePage } from '@/features/projects/ProjectCreatePage';
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { InspectionPage } from '@/features/construction/InspectionPage';
import { ApprovalsInboxPage } from '@/features/approvals/ApprovalsInboxPage';
import { ApprovalDetailPage } from '@/features/approvals/ApprovalDetailPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { OrgPage } from '@/features/admin/OrgPage';
import { RulesPage } from '@/features/admin/RulesPage';
import { AuditPage } from '@/features/admin/AuditPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="grid min-h-screen place-items-center"><Spinner label="Loading your session" /></div>;
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function Home() {
  const { can } = useAuth();
  return can('dashboard.read') ? <DashboardPage /> : <Navigate to="/tasks" replace />;
}

function WorkflowRedirect() {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}?tab=workflow`} replace />;
}

function NotFound() {
  return (
    <div className="p-8">
      <EmptyState icon="search_off" title="Page not found" message="That page does not exist." action={<LinkButton to="/">Go to overview</LinkButton>} />
    </div>
  );
}

function AppRoutes() {
  const { status } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={status === 'authed' ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/workflow" element={<WorkflowRedirect />} />
        <Route path="/projects/:id/inspections/:iid" element={<InspectionPage />} />
        <Route path="/approvals" element={<ApprovalsInboxPage />} />
        <Route path="/approvals/:id" element={<ApprovalDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/admin/org" element={<OrgPage />} />
        <Route path="/admin/rules" element={<RulesPage />} />
        <Route path="/admin/audit" element={<AuditPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
