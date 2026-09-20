import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, loginAs, makeTestApp } from '../helpers/app.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('auth', () => {
  it('logs in with the demo password and returns a token + me', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'approver@demo.infraflow.local', password: 'Demo@12345' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta.requestId).toBeTruthy();
    expect(body.data.token).toBeTruthy();
    expect(body.data.me.roles.map((r: { code: string }) => r.code)).toContain('APPROVING_AUTHORITY');
    expect(body.data.me.permissions).toContain('approval.decide');
    expect(body.data.me.positions[0].positionCode).toBe('DIV-EE-01');
  });

  it('rejects a wrong password and an unknown user with the same generic 401', async () => {
    const wrong = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'officer@demo.infraflow.local', password: 'nope' } });
    const unknown = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'nobody@demo.infraflow.local', password: 'nope' } });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe('UNAUTHENTICATED');
    expect(wrong.json().error.message).toBe(unknown.json().error.message);
  });

  it('validates the login body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'not-an-email' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.fieldErrors.length).toBeGreaterThan(0);
  });

  it('requires a token for /auth/me and honours it', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me' })).statusCode).toBe(401);
    const token = await loginAs(app, 'se');
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer(token) });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.positions[0].positionCode).toBe('DIST-SE-01');
  });

  it('writes login audit rows', async () => {
    const r = await app.db.query(`select count(*)::int c from audit_logs where action in ('auth.login','auth.login_failed')`);
    expect(r.rows[0].c).toBeGreaterThan(0);
  });
});

describe('org + rules', () => {
  it('returns the org tree with current holders and vacant RNB seats', async () => {
    const token = await loginAs(app, 'officer');
    const res = await app.inject({ method: 'GET', url: '/api/v1/org/tree', headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    const orgs = res.json().data as { code: string; offices: { code: string; positions: { holder: unknown }[]; children: { positions: { code: string; holder: unknown }[] }[] }[] }[];
    const demo = orgs.find((o) => o.code === 'DEMO-GOV')!;
    const dist = demo.offices.find((o) => o.code === 'DEMO-DIST-A')!;
    expect(dist.children[0]!.positions.find((p) => p.code === 'DIV-EE-01')!.holder).not.toBeNull();
    const rnb = orgs.find((o) => o.code === 'GJ-RNB')!;
    expect(rnb.offices[0]!.positions.every((p) => p.holder === null)).toBe(true);
  });

  it('forbids /users without workflow.manage but allows admin', async () => {
    const officer = await loginAs(app, 'officer');
    const admin = await loginAs(app, 'admin');
    expect((await app.inject({ method: 'GET', url: '/api/v1/users', headers: bearer(officer) })).statusCode).toBe(403);
    const ok = await app.inject({ method: 'GET', url: '/api/v1/users', headers: bearer(admin) });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.length).toBe(8);
  });

  it('lists rules with derived trust badges; synthetic never verified', async () => {
    const token = await loginAs(app, 'monitor');
    const res = await app.inject({ method: 'GET', url: '/api/v1/rules', headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    const rules = res.json().data as { ruleCode: string; trustBadge: string; executable: boolean; synthetic: boolean }[];
    expect(rules.length).toBe(25);
    const byCode = Object.fromEntries(rules.map((r) => [r.ruleCode, r]));
    expect(byCode['DEMO-AUTH-AA']).toMatchObject({ trustBadge: 'SYNTHETIC_DEMO', synthetic: true, executable: true });
    expect(byCode['RNB-WF-002']).toMatchObject({ trustBadge: 'VERIFIED_SOURCE', executable: true });
    expect(byCode['RNB-BLD-002']).toMatchObject({ trustBadge: 'CONDITIONAL', executable: true });
    expect(byCode['RNB-BLD-001']).toMatchObject({ trustBadge: 'CURRENCY_CHECK_REQUIRED', executable: false });
    expect(byCode['RULE-012']).toMatchObject({ trustBadge: 'CONTRACT_SPECIFIC', executable: false });
  });

  it('returns provenance: source, citations and usage; never a fake citation', async () => {
    const token = await loginAs(app, 'monitor');
    const list = (await app.inject({ method: 'GET', url: '/api/v1/rules?q=RNB-WF-002', headers: bearer(token) })).json().data;
    const res = await app.inject({ method: 'GET', url: `/api/v1/rules/${list[0].id}/provenance`, headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    const p = res.json().data;
    expect(p.rule.source.code).toBe('SRC-EWM-2020');
    expect(p.citations[0].locator).toBe('Volume I, Section 3.2.2');
    expect(p.usage.workflowNodes.map((n: { nodeCode: string }) => n.nodeCode)).toContain('ADMIN_APPROVAL');
  });

  it('returns 404 for an unknown rule and 400 for a malformed id', async () => {
    const token = await loginAs(app, 'monitor');
    expect((await app.inject({ method: 'GET', url: '/api/v1/rules/00000000-0000-0000-0000-000000000000/provenance', headers: bearer(token) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/v1/rules/not-a-uuid', headers: bearer(token) })).statusCode).toBe(400);
  });
});
