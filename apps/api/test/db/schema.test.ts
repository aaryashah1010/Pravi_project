import { afterAll, describe, expect, it } from 'vitest';
import { newPool, scalar } from '../helpers/testdb.js';
import { seed } from '../../../../scripts/db-seed.js';

const pool = newPool();
afterAll(() => pool.end());

describe('migrations + seeds (doc 44 readiness)', () => {
  it('applies all migrations from an empty database', async () => {
    expect(await scalar<string>(pool, `select count(*)::text from _migrations`)).toBe('23');
  });

  it('seeds are idempotent (second run changes no row counts)', async () => {
    const counts = () =>
      pool.query(`select
        (select count(*) from app_users)::int u, (select count(*) from rule_versions)::int rv,
        (select count(*) from rule_citations)::int rc, (select count(*) from authority_rules)::int ar,
        (select count(*) from workflow_node_templates)::int wn, (select count(*) from workflow_edge_templates)::int we,
        (select count(*) from positions)::int p, (select count(*) from user_position_assignments)::int upa,
        (select count(*) from user_role_assignments)::int ura, (select count(*) from role_permissions)::int rp`);
    const before = (await counts()).rows[0];
    await seed('test', () => {});
    expect((await counts()).rows[0]).toEqual(before);
  });

  it('every demo user has a password hash after seeding', async () => {
    expect(await scalar<string>(pool, `select count(*)::text from app_users where password_hash is null`)).toBe('0');
  });
});

describe('rule safety invariants', () => {
  it('DB refuses an ENFORCEABLE rule that is not VERIFIED', async () => {
    const src = await scalar<string>(pool, `select id from rule_sources limit 1`);
    await expect(
      pool.query(
        `insert into rule_versions (rule_code, version_no, rule_name, rule_category, enforcement_mode, verification_status, source_id)
         values ('TEST-UNVERIFIED', 1, 'x', 'OTHER', 'ENFORCEABLE', 'UNVERIFIED', $1)`,
        [src],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('seeded ENFORCEABLE rules are all VERIFIED with a source', async () => {
    const bad = await scalar<string>(
      pool,
      `select count(*)::text from rule_versions where enforcement_mode='ENFORCEABLE' and verification_status<>'VERIFIED'`,
    );
    expect(bad).toBe('0');
  });

  it('advisory/currency-check rules are never ENFORCEABLE', async () => {
    const r = await pool.query(
      `select rule_code, enforcement_mode from rule_versions where rule_code in ('RNB-BLD-001','RNB-TND-002','RNB-CNT-002','RULE-010','RULE-012')`,
    );
    expect(r.rows).toHaveLength(5);
    for (const row of r.rows) expect(row.enforcement_mode).toBe('ADVISORY_ONLY');
  });

  it('every authority rule is backed by an executable, synthetic, DEMO-GOV-only rule version', async () => {
    const r = await pool.query(
      `select ar.code, rv.enforcement_mode, rv.verification_status, rv.scope->>'synthetic' as synthetic, org.code as org
         from authority_rules ar
         join rule_versions rv on rv.id = ar.rule_version_id
         join organizations org on org.id = ar.department_organization_id`,
    );
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(row.enforcement_mode).toBe('ENFORCEABLE');
      expect(row.verification_status).toBe('VERIFIED');
      expect(row.synthetic).toBe('true');
      expect(row.org).toBe('DEMO-GOV');
    }
  });

  it('real R&B department has NO authority rules (engine must return MANUAL_REVIEW)', async () => {
    expect(
      await scalar<string>(
        pool,
        `select count(*)::text from authority_rules ar join organizations o on o.id=ar.department_organization_id where o.code='GJ-RNB'`,
      ),
    ).toBe('0');
  });

  it('authority cost bands never overlap, including exactly at the boundary', async () => {
    const matches = (type: string, cost: string) =>
      scalar<string>(
        pool,
        `select count(*)::text from authority_rules where decision_type=$1 and status='ACTIVE'
           and (min_cost is null or $2::numeric >= min_cost) and (max_cost is null or $2::numeric <= max_cost)`,
        [type, cost],
      );
    for (const cost of ['0', '49999999.99', '50000000.00', '50000000.01', '120000000.00', '150000000.00', '150000000.01', '999999999999.00']) {
      expect(await matches('ADMINISTRATIVE_APPROVAL', cost), `AA @ ${cost}`).toBe('1');
      expect(await matches('TECHNICAL_SANCTION', cost), `TS @ ${cost}`).toBe('1');
      expect(await matches('TENDER_DTP_APPROVAL', cost), `DTP @ ${cost}`).toBe('1');
    }
  });

  it('synthetic 12 Cr project routes AA to SE and TS to EE position types', async () => {
    const r = await pool.query(
      `select ar.decision_type, pt.code as ptype from authority_rules ar join position_types pt on pt.id=ar.required_position_type_id
        where ar.decision_type in ('ADMINISTRATIVE_APPROVAL','TECHNICAL_SANCTION')
          and 120000000::numeric >= coalesce(ar.min_cost,0) and (ar.max_cost is null or 120000000::numeric <= ar.max_cost)`,
    );
    const byType = Object.fromEntries(r.rows.map((x) => [x.decision_type, x.ptype]));
    expect(byType).toEqual({ ADMINISTRATIVE_APPROVAL: 'DEMO-SE', TECHNICAL_SANCTION: 'DEMO-EE' });
  });
});

describe('position-based routing data', () => {
  it('current-holder view resolves the EE and SE seats to users, RNB seats are vacant', async () => {
    const r = await pool.query(
      `select p.position_code, h.user_id is not null as has_holder
         from positions p left join v_current_position_holders h on h.position_id = p.id`,
    );
    const m = Object.fromEntries(r.rows.map((x) => [x.position_code, x.has_holder]));
    expect(m['DIV-EE-01']).toBe(true);
    expect(m['DIST-SE-01']).toBe(true);
    expect(m['RNB-EE-01']).toBe(false);
    expect(m['RNB-OFFICER-01']).toBe(false);
  });
});

describe('workflow template graph', () => {
  it('has 19 nodes and 22 edges; every node links a rule or is explicitly a configured prerequisite', async () => {
    expect(await scalar<string>(pool, `select count(*)::text from workflow_node_templates`)).toBe('19');
    expect(await scalar<string>(pool, `select count(*)::text from workflow_edge_templates`)).toBe('22');
    const noRule = await pool.query(`select node_code from workflow_node_templates where rule_version_id is null order by node_code`);
    expect(noRule.rows.map((r) => r.node_code)).toEqual(['COMPLETION', 'EXEC_FINISHING', 'EXEC_FOUNDATION', 'EXEC_SUPERSTRUCTURE', 'HANDOVER', 'WORK_ORDER']);
  });

  it('template is acyclic (topological sort consumes every node)', async () => {
    const r = await pool.query(`select from_node_template_id f, to_node_template_id t from workflow_edge_templates`);
    const n = await pool.query(`select id from workflow_node_templates`);
    const indeg = new Map<string, number>(n.rows.map((x) => [x.id, 0]));
    const adj = new Map<string, string[]>();
    for (const e of r.rows) {
      indeg.set(e.t, (indeg.get(e.t) ?? 0) + 1);
      adj.set(e.f, [...(adj.get(e.f) ?? []), e.t]);
    }
    const q = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
    let seen = 0;
    while (q.length) {
      const id = q.pop()!;
      seen++;
      for (const t of adj.get(id) ?? []) {
        indeg.set(t, indeg.get(t)! - 1);
        if (indeg.get(t) === 0) q.push(t);
      }
    }
    expect(seen).toBe(n.rows.length);
  });

  it('recursive downstream of SITE_HANDOVER is exactly 7 gating steps (root-blocker impact)', async () => {
    const r = await pool.query(`
      with recursive down as (
        select e.to_node_template_id as node_id, 1 as depth
          from workflow_edge_templates e join workflow_node_templates n on n.id = e.from_node_template_id
         where n.node_code = 'SITE_HANDOVER' and e.dependency_type in ('BLOCKING','REQUIRES_COMPLETION')
        union
        select e.to_node_template_id, d.depth + 1
          from down d join workflow_edge_templates e on e.from_node_template_id = d.node_id
         where e.dependency_type in ('BLOCKING','REQUIRES_COMPLETION') and d.depth < 50
      ) select count(distinct node_id)::int as c, max(depth)::int as deepest from down`);
    expect(r.rows[0].c).toBe(7);
  });
});

describe('append-only + outbox + optimistic locking', () => {
  it('audit_logs cannot be updated or deleted', async () => {
    await pool.query(`insert into audit_logs (action, entity_type, request_id) values ('TEST','TEST','req-test')`);
    await expect(pool.query(`update audit_logs set action='X' where request_id='req-test'`)).rejects.toThrow(/append-only/i);
    await expect(pool.query(`delete from audit_logs where request_id='req-test'`)).rejects.toThrow(/append-only/i);
  });

  it('domain_events: publish bookkeeping allowed; payload edits and deletes rejected', async () => {
    const id = await scalar<string>(
      pool,
      `insert into domain_events (aggregate_type, aggregate_id, event_type, payload)
       values ('TEST', gen_random_uuid(), 'TestEvent', '{"a":1}') returning id`,
    );
    await pool.query(`update domain_events set published_at = now(), publication_attempts = publication_attempts + 1 where id = $1`, [id]);
    await expect(pool.query(`update domain_events set payload = '{"a":2}' where id = $1`, [id])).rejects.toThrow(/append-only/i);
    await expect(pool.query(`delete from domain_events where id = $1`, [id])).rejects.toThrow(/append-only/i);
  });

  it('outbox claim with SKIP LOCKED never hands the same event to two workers', async () => {
    await pool.query(`insert into domain_events (aggregate_type, aggregate_id, event_type, payload)
                      select 'TEST', gen_random_uuid(), 'Claim', '{}' from generate_series(1,4)`);
    const a = await pool.connect();
    const b = await pool.connect();
    try {
      await a.query('begin');
      await b.query('begin');
      const q = `select id from domain_events where published_at is null and event_type='Claim' order by occurred_at for update skip locked limit 2`;
      const ra = await a.query(q);
      const rb = await b.query(q);
      const ids = new Set([...ra.rows, ...rb.rows].map((r) => r.id));
      expect(ra.rows).toHaveLength(2);
      expect(rb.rows).toHaveLength(2);
      expect(ids.size).toBe(4);
    } finally {
      await a.query('rollback');
      await b.query('rollback');
      a.release();
      b.release();
    }
  });

  it('optimistic lock: a stale version_no updates zero rows', async () => {
    const userId = await scalar<string>(pool, `select id from app_users limit 1`);
    const pid = await scalar<string>(
      pool,
      `insert into projects (project_code, name, project_type_id, department_organization_id, owning_office_id, estimated_cost, created_by)
       select 'TEST-LOCK-1','lock test', pt.id, o.id, f.id, 1000, $1
         from project_types pt, organizations o, offices f
        where pt.code='GOV_BUILDING' and o.code='DEMO-GOV' and f.code='DEMO-DIV-A' returning id`,
      [userId],
    );
    const upd = `update projects set operational_status=$2, version_no = version_no + 1 where id=$1 and version_no=$3 returning version_no`;
    const first = await pool.query(upd, [pid, 'AT_RISK', 1]);
    const stale = await pool.query(upd, [pid, 'BLOCKED', 1]);
    expect(first.rowCount).toBe(1);
    expect(stale.rowCount).toBe(0);
  });

  it('same document bytes can be stored on two documents (global sha256 unique removed)', async () => {
    const userId = await scalar<string>(pool, `select id from app_users limit 1`);
    const pid = await scalar<string>(pool, `select id from projects where project_code='TEST-LOCK-1'`);
    const dt = await scalar<string>(pool, `select id from document_types where code='SITE_PHOTO'`);
    for (const t of ['a', 'b']) {
      const did = await scalar<string>(
        pool,
        `insert into documents (project_id, document_type_id, title) values ($1,$2,$3) returning id`,
        [pid, dt, `doc ${t}`],
      );
      await pool.query(
        `insert into document_versions (document_id, version_no, storage_key, storage_provider, mime_type, size_bytes, sha256, uploaded_by)
         values ($1, 1, 'k', 'LOCAL', 'image/jpeg', 1, 'samehash', $2)`,
        [did, userId],
      );
    }
    expect(await scalar<string>(pool, `select count(*)::text from document_versions where sha256='samehash'`)).toBe('2');
  });
});
