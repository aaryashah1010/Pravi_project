// DTOs that are not (yet) part of @infraflow/shared. Mirrors the API service return shapes.
import type { TrustBadge } from '@infraflow/shared';

export interface RuleSource {
  id: string | null;
  code: string | null;
  title: string | null;
  issuingAuthority: string | null;
  type: string | null;
  verificationLevel: string | null;
  officialUrl: string | null;
  notes: string | null;
}

export interface RuleDto {
  id: string;
  ruleCode: string;
  versionNo: number;
  name: string;
  category: string;
  statement: string | null;
  note: string | null;
  scope: Record<string, unknown> | null;
  conditions: Record<string, unknown> | null;
  enforcementMode: string;
  verificationStatus: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  executable: boolean;
  trustBadge: TrustBadge;
  synthetic: boolean;
  source: RuleSource;
}

export interface CitationDto {
  type: string;
  locator: string;
  pageStart: number | null;
  pageEnd: number | null;
  notes: string | null;
}

export interface ProvenanceDto {
  rule: RuleDto;
  citations: CitationDto[];
  usage: {
    workflowNodes: { templateCode: string; nodeCode: string; name: string; nodeType: string }[];
    authorityRules: { code: string; decisionType: string; minCost: string | null; maxCost: string | null; requiredPosition: string | null }[];
  };
}

export interface TaskDto {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  nodeCode: string | null;
  taskType: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  overdue: boolean;
  ageDays: number;
  versionNo: number;
  assignedPosition: { code: string; designation: string; officeName: string } | null;
  viaSeat: boolean;
  vacantSeat: boolean;
  canComplete: boolean;
}

export interface DocumentDto {
  id: string;
  projectId: string;
  title: string;
  documentType: { code: string; name: string };
  classification: string;
  versionNo: number;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
  status: string;
  filename: string | null;
  linkedNodes: string[];
  requirementStatus: string | null;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: string;
  link: string | null;
  projectId: string | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationsResponse {
  items: NotificationDto[];
  unread: number;
}

export interface OfficeDto {
  id: string;
  code: string;
  name: string;
  officeType: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  parentOfficeId: string | null;
}

export interface PositionDto {
  id: string;
  code: string;
  designation: string;
  positionTypeCode: string;
  displayName: string | null;
  officeId: string;
  officeName: string;
  status: string;
  holder: { userId: string; displayName: string } | null;
}

export interface OrganizationRef {
  id: string;
  code: string;
  name: string;
  organization_type: string;
}

export interface JurisdictionRef {
  id: string;
  code: string;
  name: string;
  jurisdiction_type: string;
  parent_jurisdiction_id: string | null;
}

export interface OrgReference {
  organizations: OrganizationRef[];
  jurisdictions: JurisdictionRef[];
  projectTypes: { id: string; code: string; name: string }[];
}

export interface OrgTreeOffice {
  id: string;
  code: string;
  name: string;
  officeType: string;
  parentOfficeId: string | null;
  jurisdictions: { code: string; name: string; type: string; coverage: string }[];
  positions: {
    id: string;
    code: string;
    designation: string;
    displayName: string | null;
    status: string;
    holder: { userId: string; displayName: string } | null;
  }[];
  children: OrgTreeOffice[];
}

export interface OrgTreeOrganization {
  id: string;
  code: string;
  name: string;
  type: string;
  offices: OrgTreeOffice[];
}
