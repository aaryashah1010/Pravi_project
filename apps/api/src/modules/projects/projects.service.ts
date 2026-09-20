import type { CreateProjectInput, ProjectDetailDto, ProjectSummaryDto, UpdateProjectInput } from '@infraflow/shared';
import { type Db, type Queryable, withTx } from '../../platform/db.js';
import { type Actor, type RequestContext, hasGlobalScope } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { conflict, forbidden, notFound, validation } from '../../platform/errors.js';
import * as repo from './projects.repo.js';
import { generateWorkflow, reevaluateConditions } from '../workflows/workflows.service.js';
import * as wfRepo from '../workflows/workflows.repo.js';

export function toSummary(p: repo.ProjectRow): ProjectSummaryDto {
  return {
    id: p.id,
    code: p.project_code,
    name: p.name,
    lifecycleStage: p.lifecycle_stage,
    operationalStatus: p.operational_status,
    estimatedCost: p.estimated_cost,
    currency: p.currency,
    departmentCode: p.department_code,
    departmentName: p.department_name,
    owningOfficeName: p.owning_office_name,
    jurisdictionName: p.jurisdiction_name,
    isDemo: p.is_demo,
    hasWorkflow: p.has_workflow,
    openTaskCount: p.open_task_count,
    openApprovalCount: p.open_approval_count,
    createdAt: p.created_at.toISOString(),
  };
}

function inDepartmentScope(actor: Actor, departmentId: string): boolean {
  return hasGlobalScope(actor) || actor.roles.some((r) => r.organizationId === departmentId && r.code !== 'CONTRACTOR');
}

export async function listProjects(db: Queryable, actor: Actor, f: { status?: string; stage?: string; q?: string; limit?: number }): Promise<ProjectSummaryDto[]> {
  return (await repo.listProjects(db, actor, f)).map(toSummary);
}

export async function getProjectDetail(db: Queryable, actor: Actor, id: string): Promise<ProjectDetailDto> {
  const p = await repo.getProject(db, id, actor);
  if (!p) throw notFound('Project');
  const [site, proposal] = await Promise.all([repo.getSite(db, id), repo.getLatestProposal(db, id)]);
  return {
    ...toSummary(p),
    projectType: { code: p.project_type_code, name: p.project_type_name },
    attributes: p.attributes,
    versionNo: p.version_no,
    createdBy: { id: p.created_by, name: p.created_by_name },
    owningOfficeId: p.owning_office_id,
    departmentOrganizationId: p.department_organization_id,
    site: site && {
      addressLine: site.address_line, city: site.city, district: site.district, taluka: site.taluka, latitude: site.latitude,
      longitude: site.longitude, landOwner: site.land_owner, possessionStatus: site.possession_status, surveyStatus: site.survey_status,
      soilInvestigationStatus: site.soil_investigation_status,
    },
    proposal: proposal && { versionNo: proposal.version_no, status: proposal.status, justification: proposal.justification, preliminaryEstimate: proposal.preliminary_estimate },
  };
}

/** Load a project the actor may see, or 404 (never reveal existence of out-of-scope projects). */
export async function requireVisibleProject(db: Queryable, actor: Actor, id: string): Promise<repo.ProjectRow> {
  const p = await repo.getProject(db, id, actor);
  if (!p) throw notFound('Project');
  return p;
}

export async function createProject(db: Db, ctx: RequestContext, input: CreateProjectInput, opts: { projectCode?: string } = {}): Promise<ProjectDetailDto> {
  const actor = ctx.actor!;
  if (!inDepartmentScope(actor, input.departmentOrganizationId)) throw forbidden('You cannot create projects for this department.');

  const id = await withTx(db, async (tx) => {
    const typeId = await repo.getProjectTypeId(tx, input.projectTypeCode);
    if (!typeId) throw validation('Unknown project type.', [{ field: 'projectTypeCode', message: 'Unknown project type' }]);
    if (!(await repo.officeBelongsToOrg(tx, input.owningOfficeId, input.departmentOrganizationId))) {
      throw validation('The owning office does not belong to the department.', [{ field: 'owningOfficeId', message: 'Office not in department' }]);
    }
    const fundingId = input.fundingSourceCode ? await repo.getFundingSourceId(tx, input.fundingSourceCode) : null;
    const code = opts.projectCode ?? (await repo.nextProjectCode(tx, ctx.now));
    const projectId = await repo.insertProject(tx, {
      code, name: input.name, projectTypeId: typeId, departmentOrganizationId: input.departmentOrganizationId, owningOfficeId: input.owningOfficeId,
      primaryJurisdictionId: input.primaryJurisdictionId ?? null, estimatedCost: input.estimatedCost, fundingSourceId: fundingId,
      attributes: input.attributes, isDemo: true, createdBy: actor.userId, at: ctx.now,
    });
    if (input.primaryJurisdictionId) await repo.insertProjectJurisdiction(tx, projectId, input.primaryJurisdictionId);
    await repo.upsertSite(tx, projectId, input.site ?? {}, ctx.now);
    await repo.insertProposal(tx, {
      projectId, justification: input.proposal?.justification ?? `Proposal for ${input.name}`, estimate: input.estimatedCost,
      fundingNotes: input.proposal?.fundingNotes, userId: actor.userId, at: ctx.now,
    });
    await repo.insertMember(tx, projectId, { userId: actor.userId, type: 'PROJECT_OWNER', at: ctx.now });
    await audit(tx, ctx, {
      action: 'project.created', entityType: 'project', entityId: projectId, projectId,
      newData: { code, name: input.name, estimatedCost: input.estimatedCost, department: input.departmentOrganizationId },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: projectId, eventType: 'ProjectCreated',
      payload: { projectCode: code, name: input.name, estimatedCost: input.estimatedCost },
    });
    return projectId;
  });
  return getProjectDetail(db, actor, id);
}

/** Submit the proposal: evaluate rules, generate the workflow, start the first tasks — all in one transaction. */
export async function submitProject(db: Db, ctx: RequestContext, id: string): Promise<ProjectDetailDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const p = await requireVisibleProject(tx, actor, id);
    await repo.lockProject(tx, id);
    if (await wfRepo.getInstance(tx, id)) throw conflict('This project has already been submitted.');
    const changed = await repo.setProposalStatus(tx, id, 'DRAFT', 'SUBMITTED', actor.userId, ctx.now);
    if (!changed) throw conflict('There is no draft proposal to submit.');
    const { instanceId, nodeCount } = await generateWorkflow(tx, ctx, id);
    await audit(tx, ctx, { action: 'project.submitted', entityType: 'project', entityId: id, projectId: id, newData: { instanceId, nodeCount } });
    await emit(tx, ctx, { aggregateType: 'PROJECT', aggregateId: id, eventType: 'ProjectSubmitted', payload: { projectCode: p.project_code, instanceId, nodeCount } });
  });
  return getProjectDetail(db, actor, id);
}

/** Optimistic update. Cost is locked once a workflow exists (a sanctioned estimate changes only through a variation). */
export async function updateProject(db: Db, ctx: RequestContext, id: string, input: UpdateProjectInput): Promise<ProjectDetailDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const p = await requireVisibleProject(tx, actor, id);
    await repo.lockProject(tx, id);
    const hasWorkflow = !!(await wfRepo.getInstance(tx, id));
    if (input.estimatedCost !== undefined && hasWorkflow) {
      throw conflict('The estimated cost cannot be edited after submission; a sanctioned estimate changes only through a variation.');
    }
    const mergedAttributes = input.attributes ? { ...p.attributes, ...input.attributes } : undefined;
    const ok = await repo.updateProjectVersioned(tx, id, input.versionNo, { name: input.name, attributes: mergedAttributes, estimatedCost: input.estimatedCost }, ctx.now);
    if (!ok) throw conflict('The project was changed by someone else. Reload and try again.', { expectedVersion: input.versionNo, currentVersion: p.version_no });
    if (input.site) await repo.upsertSite(tx, id, input.site, ctx.now);
    await audit(tx, ctx, {
      action: 'project.updated', entityType: 'project', entityId: id, projectId: id,
      oldData: { name: p.name, attributes: p.attributes }, newData: { name: input.name ?? p.name, attributes: mergedAttributes ?? p.attributes },
    });
    if (hasWorkflow && (input.attributes || input.site)) await reevaluateConditions(tx, ctx, id);
  });
  return getProjectDetail(db, actor, id);
}
