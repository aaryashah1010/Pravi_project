import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AiAnswerDto,
  AiStatusDto,
  ApprovalDto,
  AttentionItemDto,
  AuditEntryDto,
  BlockersDto,
  ContractDto,
  DashboardSummaryDto,
  InspectionDto,
  IssueDto,
  MilestoneDto,
  OverdueItemDto,
  ProjectDetailDto,
  ProjectSummaryDto,
  WorkflowDto,
} from '@infraflow/shared';
import { api } from './api';
import type {
  DocumentDto,
  NotificationsResponse,
  OfficeDto,
  OrgReference,
  OrgTreeOrganization,
  PositionDto,
  ProvenanceDto,
  RuleDto,
  TaskDto,
} from './types';

/** Any business mutation can change dashboards, graphs, approvals and audit at once, so refresh everything that is on screen. */
function refreshAll(qc: QueryClient) {
  return qc.invalidateQueries();
}

// ---------- dashboards ----------
export const useSummary = (enabled = true) =>
  useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => api<DashboardSummaryDto>('/dashboard/summary'), enabled });

export const useAttention = (limit = 5, enabled = true) =>
  useQuery({ queryKey: ['dashboard', 'attention', limit], queryFn: () => api<AttentionItemDto[]>('/dashboard/attention', { query: { limit } }), enabled });

export const useOverdue = (limit = 8, enabled = true) =>
  useQuery({ queryKey: ['dashboard', 'overdue', limit], queryFn: () => api<OverdueItemDto[]>('/dashboard/overdue', { query: { limit } }), enabled });

export const useDashboardApprovals = (limit = 6, enabled = true) =>
  useQuery({ queryKey: ['dashboard', 'approvals', limit], queryFn: () => api<ApprovalDto[]>('/dashboard/approvals', { query: { limit } }), enabled });

// ---------- projects ----------
export interface ProjectFilters {
  status?: string;
  stage?: string;
  q?: string;
}

export const useProjects = (f: ProjectFilters = {}, enabled = true) =>
  useQuery({
    queryKey: ['projects', f],
    queryFn: () => api<ProjectSummaryDto[]>('/projects', { query: { ...f, limit: 200 } }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useProject = (id: string | undefined) =>
  useQuery({ queryKey: ['project', id], queryFn: () => api<ProjectDetailDto>(`/projects/${id}`), enabled: !!id });

export const useWorkflow = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['workflow', id], queryFn: () => api<WorkflowDto>(`/projects/${id}/workflow`), enabled: !!id && enabled, retry: false });

export const useBlockers = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['blockers', id], queryFn: () => api<BlockersDto>(`/projects/${id}/blockers`), enabled: !!id && enabled, retry: false });

export const useProjectTasks = (id: string | undefined) =>
  useQuery({ queryKey: ['project-tasks', id], queryFn: () => api<TaskDto[]>(`/projects/${id}/tasks`), enabled: !!id });

export const useProjectDocuments = (id: string | undefined) =>
  useQuery({ queryKey: ['documents', id], queryFn: () => api<DocumentDto[]>(`/projects/${id}/documents`), enabled: !!id });

export const useProjectAudit = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['project-audit', id], queryFn: () => api<AuditEntryDto[]>(`/projects/${id}/audit`, { query: { limit: 100 } }), enabled: !!id && enabled });

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: object) => api<ProjectDetailDto>('/projects', { method: 'POST', body: input }),
    onSuccess: () => refreshAll(qc),
  });
}

export function useSubmitProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ProjectDetailDto>(`/projects/${id}/submit`, { method: 'POST' }),
    onSuccess: () => refreshAll(qc),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { versionNo: number; name?: string; attributes?: Record<string, unknown> }) =>
      api<ProjectDetailDto>(`/projects/${id}`, { method: 'PATCH', body }),
    onSuccess: () => refreshAll(qc),
  });
}

// ---------- approvals ----------
export interface ApprovalFilters {
  status?: string;
  projectId?: string;
  mine?: boolean;
}

export const useApprovals = (f: ApprovalFilters = {}, enabled = true) =>
  useQuery({
    queryKey: ['approvals', f],
    queryFn: () => api<ApprovalDto[]>('/approvals', { query: { status: f.status, projectId: f.projectId, mine: f.mine ? 'true' : undefined } }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useApproval = (id: string | undefined) =>
  useQuery({ queryKey: ['approval', id], queryFn: () => api<ApprovalDto>(`/approvals/${id}`), enabled: !!id });

export type DecisionAction = 'approve' | 'return' | 'reject' | 'request-info';

export function useSubmitApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ApprovalDto>(`/approvals/${id}/submit`, { method: 'POST' }),
    onSuccess: () => refreshAll(qc),
    onError: () => refreshAll(qc),
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: DecisionAction; reason?: string }) =>
      api<ApprovalDto>(`/approvals/${v.id}/${v.action}`, { method: 'POST', body: { reason: v.reason } }),
    onSuccess: () => refreshAll(qc),
    onError: (e) => {
      // A 409 means the case moved on under us; pull the fresh state so the buttons match the server.
      if (typeof e === 'object' && e && 'status' in e && (e as { status: number }).status === 409) void refreshAll(qc);
    },
  });
}

export function useManualAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; positionId: string; reason: string }) =>
      api<ApprovalDto>(`/approvals/${v.id}/manual-assign`, { method: 'POST', body: { positionId: v.positionId, reason: v.reason } }),
    onSuccess: () => refreshAll(qc),
  });
}

// ---------- tasks ----------
export const useMyTasks = (enabled = true) =>
  useQuery({ queryKey: ['tasks', 'mine'], queryFn: () => api<TaskDto[]>('/tasks/mine'), enabled, refetchInterval: 30_000 });

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: { id: string; versionNo: number }) => api<TaskDto>(`/tasks/${t.id}/complete`, { method: 'POST', body: { versionNo: t.versionNo } }),
    onSuccess: () => refreshAll(qc),
    onError: (e) => {
      if (typeof e === 'object' && e && 'status' in e && (e as { status: number }).status === 409) void refreshAll(qc);
    },
  });
}

// ---------- documents ----------
export function useUploadDocument(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { documentTypeCode: string; nodeCode?: string; file: File }) => {
      const fd = new FormData();
      fd.append('documentTypeCode', v.documentTypeCode);
      if (v.nodeCode) fd.append('nodeCode', v.nodeCode);
      fd.append('file', v.file);
      return api<DocumentDto>(`/projects/${projectId}/documents`, { method: 'POST', formData: fd });
    },
    onSuccess: () => refreshAll(qc),
  });
}

export function useVerifyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: 'VERIFIED' | 'REJECTED'; note?: string }) =>
      api<DocumentDto>(`/documents/${v.id}/verify`, { method: 'POST', body: { status: v.status, note: v.note } }),
    onSuccess: () => refreshAll(qc),
  });
}

// ---------- notifications ----------
export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationsResponse>('/notifications'), refetchInterval: 10_000, refetchIntervalInBackground: false });

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ updated: number }>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ---------- rules ----------
export interface RuleFilters {
  category?: string;
  verification?: string;
  q?: string;
}

export const useRules = (f: RuleFilters = {}) =>
  useQuery({ queryKey: ['rules', f], queryFn: () => api<RuleDto[]>('/rules', { query: { ...f } }), placeholderData: keepPreviousData });

export const useProvenance = (ruleId: string | undefined) =>
  useQuery({ queryKey: ['provenance', ruleId], queryFn: () => api<ProvenanceDto>(`/rules/${ruleId}/provenance`), enabled: !!ruleId, staleTime: 60_000 });

// ---------- org ----------
export const useOrgTree = () => useQuery({ queryKey: ['org', 'tree'], queryFn: () => api<OrgTreeOrganization[]>('/org/tree') });
export const useOffices = () => useQuery({ queryKey: ['org', 'offices'], queryFn: () => api<OfficeDto[]>('/offices'), staleTime: 5 * 60_000 });
export const usePositions = (enabled = true) =>
  useQuery({ queryKey: ['org', 'positions'], queryFn: () => api<PositionDto[]>('/positions'), staleTime: 60_000, enabled });
export const useOrgReference = () => useQuery({ queryKey: ['org', 'reference'], queryFn: () => api<OrgReference>('/org/reference'), staleTime: 5 * 60_000 });

// ---------- audit ----------
export interface AuditFilters {
  projectId?: string;
  action?: string;
  from?: string;
  to?: string;
}

export const useRecentAudit = (limit: number, enabled = true) =>
  useQuery({ queryKey: ['audit', 'recent', limit], queryFn: () => api<AuditEntryDto[]>('/audit', { query: { limit } }), enabled });

export function useAuditFeed(f: AuditFilters, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: ['audit', 'feed', f, pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<AuditEntryDto[]>('/audit', { query: { ...f, limit: pageSize, before: pageParam } }),
    getNextPageParam: (last) => (last.length === pageSize ? last[last.length - 1]?.at : undefined),
  });
}

// ---------- construction: milestones, inspections, issues, contract ----------
export const useMilestones = (projectId: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['milestones', projectId], queryFn: () => api<MilestoneDto[]>(`/projects/${projectId}/milestones`), enabled: !!projectId && enabled });

export function useReportProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reportedProgress: number; narrative?: string }) =>
      api<MilestoneDto>(`/milestones/${v.id}/progress`, { method: 'POST', body: { reportedProgress: v.reportedProgress, narrative: v.narrative } }),
    onSuccess: () => refreshAll(qc),
  });
}

export const useInspections = (projectId: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['inspections', projectId], queryFn: () => api<InspectionDto[]>(`/projects/${projectId}/inspections`), enabled: !!projectId && enabled });

export const useInspection = (id: string | undefined) =>
  useQuery({ queryKey: ['inspection', id], queryFn: () => api<InspectionDto>(`/inspections/${id}`), enabled: !!id });

export function useRequestInspection(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { milestoneCode: string; note?: string }) => api<InspectionDto>(`/projects/${projectId}/inspections`, { method: 'POST', body: v }),
    onSuccess: () => refreshAll(qc),
  });
}

export interface InspectionSubmitBody {
  result: 'PASS' | 'FAIL' | 'OBSERVATION';
  observations?: string;
  latitude?: number;
  longitude?: number;
  checklist: { itemCode: string; result: 'PASS' | 'FAIL' | 'NA' | 'OBSERVATION'; notes?: string }[];
  verifiedProgress?: number;
  measurement?: { reference: string; quantity: number; unit: string };
}

export function useSubmitInspection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InspectionSubmitBody) => api<InspectionDto>(`/inspections/${id}/submit`, { method: 'POST', body }),
    onSuccess: () => refreshAll(qc),
  });
}

export function useUploadEvidence(projectId: string, inspectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { file: File; title?: string; latitude?: number; longitude?: number }) => {
      const fd = new FormData();
      fd.append('documentTypeCode', 'SITE_PHOTO');
      fd.append('inspectionId', inspectionId);
      if (v.title) fd.append('title', v.title);
      if (v.latitude !== undefined && v.longitude !== undefined) {
        fd.append('latitude', String(v.latitude));
        fd.append('longitude', String(v.longitude));
      }
      fd.append('file', v.file);
      return api<DocumentDto>(`/projects/${projectId}/documents`, { method: 'POST', formData: fd });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', inspectionId] }),
  });
}

export const useIssues = (projectId: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['issues', projectId], queryFn: () => api<IssueDto[]>(`/projects/${projectId}/issues`), enabled: !!projectId && enabled });

export function useCreateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => api<IssueDto>(`/projects/${projectId}/issues`, { method: 'POST', body }),
    onSuccess: () => refreshAll(qc),
  });
}

export function useResolveIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; resolution: string }) => api<IssueDto>(`/issues/${v.id}/resolve`, { method: 'POST', body: { resolution: v.resolution } }),
    onSuccess: () => refreshAll(qc),
  });
}

export const useContract = (projectId: string | undefined) =>
  useQuery({ queryKey: ['contract', projectId], queryFn: () => api<ContractDto | null>(`/projects/${projectId}/contract`), enabled: !!projectId });

// ---------- AI copilot (advisory) ----------
export const useAiStatus = () => useQuery({ queryKey: ['ai', 'status'], queryFn: () => api<AiStatusDto>('/ai/status'), staleTime: 60_000 });

export type AiEndpoint = 'explain-blocker' | 'next-actions' | 'missing-documents' | 'summarize' | 'why-required' | 'ask';

export function useAskAi() {
  return useMutation({
    mutationFn: (v: { endpoint: AiEndpoint; projectId: string; question?: string; nodeCode?: string }) =>
      api<AiAnswerDto>(`/ai/${v.endpoint}`, { method: 'POST', body: { projectId: v.projectId, question: v.question, nodeCode: v.nodeCode } }),
  });
}
