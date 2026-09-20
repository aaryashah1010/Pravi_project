import type { Queryable } from '../../platform/db.js';
import * as repo from './org.repo.js';

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

export async function getOrgTree(db: Queryable) {
  const [orgs, offices, positions, coverage] = await Promise.all([
    repo.listOrganizations(db),
    repo.listOffices(db),
    repo.listPositions(db),
    repo.listOfficeJurisdictions(db),
  ]);

  const nodeById = new Map<string, OrgTreeOffice>();
  for (const o of offices) {
    nodeById.set(o.id, {
      id: o.id,
      code: o.code,
      name: o.name,
      officeType: o.office_type,
      parentOfficeId: o.parent_office_id,
      jurisdictions: coverage
        .filter((c) => c.office_id === o.id)
        .map((c) => ({ code: c.code, name: c.name, type: c.jurisdiction_type, coverage: c.coverage_type })),
      positions: positions
        .filter((p) => p.office_id === o.id)
        .map((p) => ({
          id: p.id,
          code: p.position_code,
          designation: p.designation,
          displayName: p.display_name,
          status: p.status,
          holder: p.holder_user_id ? { userId: p.holder_user_id, displayName: p.holder_name! } : null,
        })),
      children: [],
    });
  }
  const rootsByOrg = new Map<string, OrgTreeOffice[]>();
  for (const o of offices) {
    const node = nodeById.get(o.id)!;
    const parent = o.parent_office_id ? nodeById.get(o.parent_office_id) : undefined;
    if (parent) parent.children.push(node);
    else rootsByOrg.set(o.organization_id, [...(rootsByOrg.get(o.organization_id) ?? []), node]);
  }
  return orgs.map((org) => ({
    id: org.id,
    code: org.code,
    name: org.name,
    type: org.organization_type,
    offices: rootsByOrg.get(org.id) ?? [],
  }));
}

export async function getPositionBrief(db: Queryable, positionId: string) {
  const p = await repo.getPositionBrief(db, positionId);
  if (!p) return null;
  return {
    id: p.id,
    code: p.position_code,
    designation: p.designation,
    officeName: p.office_name,
    holder: p.holder_user_id ? { userId: p.holder_user_id, displayName: p.holder_name! } : null,
  };
}

export const listOffices = repo.listOffices;
export const listPositions = repo.listPositions;
export const listUsers = repo.listUsers;
export const listOrganizations = repo.listOrganizations;
export const listJurisdictions = repo.listJurisdictions;
export const listProjectTypes = repo.listProjectTypes;
