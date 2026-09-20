export interface AuditEntryDto {
  id: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string | null;
  projectId: string | null;
  projectCode: string | null;
  actorName: string | null;
  actorRole: string | null;
  actorPositionCode: string | null;
  actorDesignation: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  newData: unknown;
}
