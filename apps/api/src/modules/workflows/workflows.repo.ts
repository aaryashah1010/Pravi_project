import type { Queryable } from '../../platform/db.js';
import type { DependencyType, TemplateEdgeIn, TemplateNodeIn } from './domain/generator.js';

export interface TemplateRow {
  id: string;
  code: string;
  name: string;
  version_no: number;
}

/** Most specific active template first (department-specific > type-specific > generic), then highest version. */
export async function findTemplate(db: Queryable, projectTypeId: string, departmentId: string, today: string): Promise<TemplateRow | null> {
  const r = await db.query<TemplateRow>(
    `SELECT id, code, name, version_no FROM workflow_templates
      WHERE status = 'ACTIVE'
        AND (project_type_id IS NULL OR project_type_id = $1)
        AND (department_organization_id IS NULL OR department_organization_id = $2)
        AND (effective_from IS NULL OR effective_from <= $3::date) AND (effective_to IS NULL OR effective_to >= $3::date)
      ORDER BY (department_organization_id IS NOT NULL) DESC, (project_type_id IS NOT NULL) DESC, version_no DESC LIMIT 1`,
    [projectTypeId, departmentId, today],
  );
  return r.rows[0] ?? null;
}

export async function loadTemplateNodes(db: Queryable, templateId: string): Promise<TemplateNodeIn[]> {
  const r = await db.query<TemplateNodeIn>(
    `SELECT id, node_code, name, node_type, required_by_default, activation_condition, assigned_position_type_id, rule_version_id, config
       FROM workflow_node_templates WHERE workflow_template_id = $1 ORDER BY created_at, node_code`,
    [templateId],
  );
  return r.rows;
}

export async function loadTemplateEdges(db: Queryable, templateId: string): Promise<TemplateEdgeIn[]> {
  const r = await db.query<TemplateEdgeIn>(
    `SELECT from_node_template_id, to_node_template_id, dependency_type, condition FROM workflow_edge_templates WHERE workflow_template_id = $1`,
    [templateId],
  );
  return r.rows;
}

export async function positionTypeIdByCode(db: Queryable, code: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(`SELECT id FROM position_types WHERE code = $1`, [code]);
  return r.rows[0]?.id ?? null;
}

export interface InstanceRow {
  id: string;
  project_id: string;
  workflow_template_id: string;
  template_version_no: number;
  template_code: string;
  state: string;
  generated_at: Date;
  completed_at: Date | null;
}

export async function getInstance(db: Queryable, projectId: string): Promise<InstanceRow | null> {
  const r = await db.query<InstanceRow>(
    `SELECT wi.id, wi.project_id, wi.workflow_template_id, wi.template_version_no, wt.code AS template_code, wi.state, wi.generated_at, wi.completed_at
       FROM workflow_instances wi JOIN workflow_templates wt ON wt.id = wi.workflow_template_id WHERE wi.project_id = $1`,
    [projectId],
  );
  return r.rows[0] ?? null;
}

export async function insertInstance(
  tx: Queryable,
  i: { projectId: string; templateId: string; versionNo: number; snapshot: Record<string, unknown>; at: Date },
): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO workflow_instances (project_id, workflow_template_id, template_version_no, state, context_snapshot, generated_at)
     VALUES ($1,$2,$3,'ACTIVE',$4,$5) RETURNING id`,
    [i.projectId, i.templateId, i.versionNo, JSON.stringify(i.snapshot), i.at],
  );
  return r.rows[0]!.id;
}

export async function insertNodeInstance(
  tx: Queryable,
  n: {
    instanceId: string;
    nodeTemplateId: string;
    nodeCode: string;
    nodeType: string;
    activationState: string;
    positionTypeId: string | null;
    ruleVersionId: string | null;
    blockingReason: unknown;
    slaDays: number | null;
    at: Date;
  },
): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO workflow_node_instances (workflow_instance_id, node_template_id, node_code, node_type, activation_state, execution_state,
                                          assigned_position_type_id, source_rule_version_id, blocking_reason, sla_days, created_at)
     VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,$10) RETURNING id`,
    [n.instanceId, n.nodeTemplateId, n.nodeCode, n.nodeType, n.activationState, n.positionTypeId, n.ruleVersionId,
     n.blockingReason ? JSON.stringify(n.blockingReason) : null, n.slaDays, n.at],
  );
  return r.rows[0]!.id;
}

export async function insertDependency(
  tx: Queryable,
  d: { instanceId: string; fromId: string; toId: string; type: DependencyType; condition: unknown; state: string; at: Date },
): Promise<void> {
  await tx.query(
    `INSERT INTO workflow_instance_dependencies (workflow_instance_id, from_node_instance_id, to_node_instance_id, dependency_type, condition, state, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
    [d.instanceId, d.fromId, d.toId, d.type, JSON.stringify(d.condition ?? {}), d.state, d.at],
  );
}

export async function insertRequiredDocs(tx: Queryable, projectId: string, nodeInstanceId: string, nodeTemplateId: string, ruleVersionId: string | null): Promise<void> {
  await tx.query(
    `INSERT INTO project_required_documents (project_id, workflow_node_instance_id, document_type_id, required, status, source_rule_version_id)
     SELECT $1, $2, wrd.document_type_id, wrd.required, 'MISSING', $4 FROM workflow_required_documents wrd WHERE wrd.node_template_id = $3
     ON CONFLICT DO NOTHING`,
    [projectId, nodeInstanceId, nodeTemplateId, ruleVersionId],
  );
}

export async function insertRuleEvaluation(
  tx: Queryable,
  e: { projectId: string; ruleVersionId: string; context: unknown; result: string; explanation: unknown; userId: string | null; at: Date },
): Promise<void> {
  await tx.query(
    `INSERT INTO rule_evaluations (project_id, rule_version_id, evaluation_context, result, explanation, evaluated_at, evaluated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [e.projectId, e.ruleVersionId, JSON.stringify(e.context), e.result, JSON.stringify(e.explanation), e.at, e.userId],
  );
}

export interface NodeRow {
  id: string;
  workflow_instance_id: string;
  node_template_id: string;
  node_code: string;
  node_type: string;
  name: string;
  activation_state: string;
  execution_state: string;
  assigned_position_type_id: string | null;
  assigned_position_id: string | null;
  assigned_user_id: string | null;
  source_rule_version_id: string | null;
  blocking_reason: { type?: string; facts?: string[]; message?: string; ruleCode?: string | null; previousActivation?: string; issueIds?: string[]; [k: string]: unknown } | null;
  eligible_at: Date | null;
  due_at: Date | null;
  sla_days: number | null;
  started_at: Date | null;
  completed_at: Date | null;
  config: Record<string, unknown>;
  activation_condition: Record<string, unknown>;
}

const NODE_SELECT = `
  SELECT n.id, n.workflow_instance_id, n.node_template_id, n.node_code, n.node_type, nt.name,
         n.activation_state, n.execution_state, n.assigned_position_type_id, n.assigned_position_id, n.assigned_user_id,
         n.source_rule_version_id, n.blocking_reason, n.eligible_at, n.due_at, n.sla_days, n.started_at, n.completed_at,
         nt.config, nt.activation_condition
    FROM workflow_node_instances n JOIN workflow_node_templates nt ON nt.id = n.node_template_id`;

export async function loadNodes(db: Queryable, instanceId: string): Promise<NodeRow[]> {
  const r = await db.query<NodeRow>(`${NODE_SELECT} WHERE n.workflow_instance_id = $1 ORDER BY n.created_at, n.node_code`, [instanceId]);
  return r.rows;
}

export async function getNode(db: Queryable, nodeId: string): Promise<(NodeRow & { project_id: string }) | null> {
  const r = await db.query<NodeRow & { project_id: string }>(
    `SELECT wi.project_id, x.* FROM (${NODE_SELECT} WHERE n.id = $1) x JOIN workflow_instances wi ON wi.id = x.workflow_instance_id`,
    [nodeId],
  );
  return r.rows[0] ?? null;
}

export async function lockNode(tx: Queryable, nodeId: string): Promise<void> {
  await tx.query(`SELECT 1 FROM workflow_node_instances WHERE id = $1 FOR UPDATE`, [nodeId]);
}

export interface DepRow {
  id: string;
  from_node_instance_id: string;
  to_node_instance_id: string;
  dependency_type: string;
  state: string;
  condition: Record<string, unknown>;
}

export async function loadDeps(db: Queryable, instanceId: string): Promise<DepRow[]> {
  const r = await db.query<DepRow>(
    `SELECT id, from_node_instance_id, to_node_instance_id, dependency_type, state, condition
       FROM workflow_instance_dependencies WHERE workflow_instance_id = $1 ORDER BY created_at, id`,
    [instanceId],
  );
  return r.rows;
}

export type NodePatch = Partial<{
  activation_state: string;
  execution_state: string;
  assigned_position_id: string | null;
  blocking_reason: unknown | null;
  eligible_at: Date | null;
  due_at: Date | null;
  sla_days: number | null;
  started_at: Date | null;
  completed_at: Date | null;
}>;

const NODE_COLUMNS = ['activation_state', 'execution_state', 'assigned_position_id', 'blocking_reason', 'eligible_at', 'due_at', 'sla_days', 'started_at', 'completed_at'] as const;

/** Only whitelisted columns; `undefined` = unchanged, `null` = set NULL. */
export async function updateNode(tx: Queryable, id: string, patch: NodePatch): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const col of NODE_COLUMNS) {
    if (!(col in patch) || patch[col] === undefined) continue;
    let v = patch[col] as unknown;
    if (col === 'blocking_reason' && v !== null) v = JSON.stringify(v);
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  }
  if (!sets.length) return;
  await tx.query(`UPDATE workflow_node_instances SET ${sets.join(', ')} WHERE id = $1`, params);
}

export async function setDependencyState(tx: Queryable, id: string, state: string, type?: string): Promise<void> {
  await tx.query(`UPDATE workflow_instance_dependencies SET state = $2, dependency_type = COALESCE($3, dependency_type) WHERE id = $1`, [id, state, type ?? null]);
}

export async function satisfyOutgoing(tx: Queryable, nodeId: string): Promise<void> {
  await tx.query(`UPDATE workflow_instance_dependencies SET state = 'SATISFIED' WHERE from_node_instance_id = $1 AND state = 'ACTIVE'`, [nodeId]);
}

export async function setInstanceState(tx: Queryable, id: string, state: string, at: Date): Promise<void> {
  await tx.query(
    `UPDATE workflow_instances SET state = $2, completed_at = CASE WHEN $2 = 'COMPLETED' THEN $3::timestamptz ELSE NULL END WHERE id = $1`,
    [id, state, at],
  );
}

export async function insertTransition(
  tx: Queryable,
  t: {
    nodeId: string;
    fromActivation: string | null;
    toActivation: string | null;
    fromExecution: string | null;
    toExecution: string | null;
    actorUserId: string | null;
    reason: string;
    metadata?: Record<string, unknown>;
    at: Date;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO workflow_transitions (workflow_node_instance_id, from_activation_state, to_activation_state, from_execution_state, to_execution_state,
                                       actor_user_id, reason, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [t.nodeId, t.fromActivation, t.toActivation, t.fromExecution, t.toExecution, t.actorUserId, t.reason, JSON.stringify(t.metadata ?? {}), t.at],
  );
}

// ---- tasks ---------------------------------------------------------------------------------
export interface TaskInsert {
  projectId: string;
  nodeId: string | null;
  taskType: string;
  title: string;
  description?: string | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  assignedPositionId?: string | null;
  assignedUserId?: string | null;
  ruleVersionId?: string | null;
  dueAt?: Date | null;
  at: Date;
}

export async function insertTask(tx: Queryable, t: TaskInsert): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO tasks (project_id, workflow_node_instance_id, task_type, title, description, priority, status,
                        assigned_user_id, assigned_position_id, source_rule_version_id, due_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9,$10,$11,$11) RETURNING id`,
    [t.projectId, t.nodeId, t.taskType, t.title, t.description ?? null, t.priority ?? 'NORMAL', t.assignedUserId ?? null,
     t.assignedPositionId ?? null, t.ruleVersionId ?? null, t.dueAt ?? null, t.at],
  );
  return r.rows[0]!.id;
}

export async function completeOpenTasks(tx: Queryable, nodeId: string, taskTypes: string[] | null, at: Date): Promise<number> {
  const r = await tx.query(
    `UPDATE tasks SET status = 'COMPLETED', completed_at = $3, version_no = version_no + 1, updated_at = $3
      WHERE workflow_node_instance_id = $1 AND status IN ('PENDING','IN_PROGRESS','OVERDUE','BLOCKED')
        AND ($2::text[] IS NULL OR task_type = ANY($2::text[]))`,
    [nodeId, taskTypes, at],
  );
  return r.rowCount ?? 0;
}

export async function hasOpenTask(db: Queryable, nodeId: string, taskType: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM tasks WHERE workflow_node_instance_id = $1 AND task_type = $2 AND status IN ('PENDING','IN_PROGRESS','OVERDUE','BLOCKED') LIMIT 1`,
    [nodeId, taskType],
  );
  return (r.rowCount ?? 0) > 0;
}

// ---- domain rows created on activation ------------------------------------------------------
export async function ensureMilestone(tx: Queryable, projectId: string, m: { code: string; name: string; seq: number | null; at: Date }): Promise<void> {
  await tx.query(
    `INSERT INTO milestones (project_id, code, name, sequence_no, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (project_id, code) DO NOTHING`,
    [projectId, m.code, m.name, m.seq, m.at],
  );
}

export async function ensureClearance(tx: Queryable, projectId: string, nodeId: string, type: string, ruleVersionId: string | null, at: Date): Promise<void> {
  const exists = await tx.query(`SELECT 1 FROM clearances WHERE workflow_node_instance_id = $1`, [nodeId]);
  if (exists.rowCount) return;
  await tx.query(
    `INSERT INTO clearances (project_id, workflow_node_instance_id, clearance_type, status, source_rule_version_id, created_at, updated_at)
     VALUES ($1,$2,$3,'PENDING',$4,$5,$5)`,
    [projectId, nodeId, type, ruleVersionId, at],
  );
}

export async function adminUserId(db: Queryable): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `SELECT u.id FROM app_users u JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.is_active
       JOIN roles r ON r.id = ura.role_id WHERE r.code = 'SYSTEM_ADMIN' AND u.status = 'ACTIVE' ORDER BY u.created_at LIMIT 1`,
  );
  return r.rows[0]?.id ?? null;
}

/** Open BLOCKS issues per workflow node of an instance (a graph concern: issues gate nodes). */
export async function openBlockingIssues(db: Queryable, instanceId: string): Promise<Map<string, { ids: string[]; title: string }>> {
  const r = await db.query<{ node_id: string; id: string; title: string }>(
    `SELECT iwl.workflow_node_instance_id AS node_id, i.id, i.title
       FROM issues i
       JOIN issue_workflow_links iwl ON iwl.issue_id = i.id AND iwl.impact_type = 'BLOCKS'
       JOIN workflow_node_instances n ON n.id = iwl.workflow_node_instance_id
      WHERE n.workflow_instance_id = $1 AND i.status IN ('OPEN','IN_PROGRESS','BLOCKED')
      ORDER BY i.opened_at`,
    [instanceId],
  );
  const out = new Map<string, { ids: string[]; title: string }>();
  for (const row of r.rows) {
    const cur = out.get(row.node_id);
    if (cur) cur.ids.push(row.id);
    else out.set(row.node_id, { ids: [row.id], title: row.title });
  }
  return out;
}

export async function setMilestoneStatusByCode(tx: Queryable, projectId: string, code: string, status: string, at: Date): Promise<void> {
  await tx.query(`UPDATE milestones SET status = $3, updated_at = $4 WHERE project_id = $1 AND code = $2`, [projectId, code, status, at]);
}
