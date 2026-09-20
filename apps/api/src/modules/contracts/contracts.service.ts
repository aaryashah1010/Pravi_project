import type { ContractDto, ContractInput } from '@infraflow/shared';
import { type Db, type Queryable, withTx } from '../../platform/db.js';
import type { Actor, RequestContext } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { notFound, validation } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';

export async function getContract(db: Queryable, actor: Actor, projectId: string): Promise<ContractDto | null> {
  if (!(await projects.getProject(db, projectId, actor))) throw notFound('Project');
  const r = await db.query(
    `SELECT c.contract_number, ct.code AS contractor_code, ct.legal_name, c.awarded_value::text, c.contract_date, c.start_date, c.completion_date,
            c.dlp_start_date, c.dlp_end_date, c.status, wo.work_order_number, wo.issue_date, wo.status AS wo_status
       FROM contracts c JOIN contractors ct ON ct.id = c.contractor_id
       LEFT JOIN LATERAL (SELECT * FROM work_orders w WHERE w.contract_id = c.id ORDER BY w.created_at DESC LIMIT 1) wo ON TRUE
      WHERE c.project_id = $1`,
    [projectId],
  );
  const x = r.rows[0];
  if (!x) return null;
  return {
    contractNumber: x.contract_number,
    contractor: { code: x.contractor_code, name: x.legal_name },
    awardedValue: x.awarded_value,
    contractDate: x.contract_date,
    startDate: x.start_date,
    completionDate: x.completion_date,
    dlpStartDate: x.dlp_start_date,
    dlpEndDate: x.dlp_end_date,
    status: x.status,
    workOrder: x.work_order_number ? { number: x.work_order_number, issueDate: x.issue_date, status: x.wo_status } : null,
  };
}

const addMonths = (isoDate: string, months: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

/**
 * Record the awarded contract (and optionally its work order) and assign the contractor to the project.
 * DLP dates are derived ONLY from the dlpMonths the contract itself states; there is no universal DLP value.
 */
export async function recordContract(db: Db, ctx: RequestContext, projectId: string, input: ContractInput): Promise<ContractDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const project = await projects.getProject(tx, projectId, actor);
    if (!project) throw notFound('Project');
    await projects.lockProject(tx, projectId);
    const contractor = (await tx.query<{ id: string }>(`SELECT id FROM contractors WHERE code = $1 AND status = 'ACTIVE'`, [input.contractorCode])).rows[0];
    if (!contractor) throw validation('Unknown contractor.', [{ field: 'contractorCode', message: 'Unknown or inactive contractor' }]);
    if (input.startDate && input.completionDate && input.completionDate < input.startDate) {
      throw validation('Completion date cannot be before the start date.', [{ field: 'completionDate', message: 'Before start date' }]);
    }
    const dlpStart = input.dlpMonths && input.completionDate ? input.completionDate : null;
    const dlpEnd = dlpStart && input.dlpMonths ? addMonths(dlpStart, input.dlpMonths) : null;
    const c = await tx.query<{ id: string }>(
      `INSERT INTO contracts (project_id, contractor_id, contract_number, awarded_value, contract_date, start_date, completion_date, dlp_start_date, dlp_end_date, status, terms, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',$10,$11,$11)
       ON CONFLICT (project_id) DO UPDATE SET contractor_id = $2, contract_number = $3, awarded_value = $4, contract_date = $5, start_date = $6,
         completion_date = $7, dlp_start_date = $8, dlp_end_date = $9, terms = $10, updated_at = $11
       RETURNING id`,
      [projectId, contractor.id, input.contractNumber, input.awardedValue, input.contractDate ?? null, input.startDate ?? null, input.completionDate ?? null,
       dlpStart, dlpEnd, JSON.stringify({ dlpMonths: input.dlpMonths ?? null, source: 'recorded from the executed contract' }), ctx.now],
    );
    const contractId = c.rows[0]!.id;
    if (input.workOrderNumber) {
      await tx.query(
        `INSERT INTO work_orders (project_id, contract_id, work_order_number, issue_date, start_date, stipulated_completion_date, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'ISSUED',$7,$7) ON CONFLICT (work_order_number) DO NOTHING`,
        [projectId, contractId, input.workOrderNumber, ctx.now.toISOString().slice(0, 10), input.startDate ?? null, input.completionDate ?? null, ctx.now],
      );
    }
    await tx.query(
      `INSERT INTO contractor_project_assignments (project_id, contractor_id, assignment_type, start_at, status) VALUES ($1,$2,'PRIMARY',$3,'ACTIVE')
       ON CONFLICT (project_id, contractor_id, assignment_type) DO UPDATE SET status = 'ACTIVE'`,
      [projectId, contractor.id, input.startDate ?? null],
    );
    await audit(tx, ctx, {
      action: 'contract.recorded', entityType: 'contract', entityId: contractId, projectId,
      newData: { contractNumber: input.contractNumber, contractor: input.contractorCode, awardedValue: input.awardedValue, workOrder: input.workOrderNumber ?? null },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: projectId, eventType: 'ContractLinked',
      payload: { projectCode: project.project_code, contractNumber: input.contractNumber, contractor: input.contractorCode },
    });
  });
  return (await getContract(db, actor, projectId))!;
}
