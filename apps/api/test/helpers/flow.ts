import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { bearer } from './app.js';

export interface Api {
  /** Same API bound to a fixed clock (requires allowDemoClock in the test/seed app). */
  at(now: Date): Api;
  get(url: string, token: string): Promise<{ status: number; body: any }>;
  post(url: string, token: string, payload?: unknown): Promise<{ status: number; body: any }>;
  patch(url: string, token: string, payload?: unknown): Promise<{ status: number; body: any }>;
  put(url: string, token: string, payload?: unknown): Promise<{ status: number; body: any }>;
  upload(projectId: string, token: string, fields: Record<string, string>, opts?: { mime?: string; content?: Buffer }): Promise<{ status: number; body: any }>;
}

export function api(app: FastifyInstance, now?: Date): Api {
  const clock = (): Record<string, string> => (now ? { 'x-demo-now': now.toISOString() } : {});
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, token: string, payload?: unknown) => {
    const res = await app.inject({ method, url: `/api/v1${url}`, headers: { ...bearer(token), ...clock() }, ...(payload !== undefined ? { payload: payload as object } : {}) });
    return { status: res.statusCode, body: res.json() };
  };
  return {
    at: (d: Date) => api(app, d),
    get: (url, token) => call('GET', url, token),
    post: (url, token, payload) => call('POST', url, token, payload ?? {}),
    patch: (url, token, payload) => call('PATCH', url, token, payload ?? {}),
    put: (url, token, payload) => call('PUT', url, token, payload ?? {}),
    async upload(projectId, token, fields, opts = {}) {
      const boundary = `----infraflow${randomUUID()}`;
      const parts: Buffer[] = [];
      for (const [k, v] of Object.entries(fields)) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
      }
      const mime = opts.mime ?? 'application/pdf';
      const content = opts.content ?? Buffer.from(`%PDF-1.4\n% test document ${randomUUID()}\n`);
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: ${mime}\r\n\r\n`));
      parts.push(content, Buffer.from(`\r\n--${boundary}--\r\n`));
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/documents`,
        headers: { ...bearer(token), ...clock(), 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: Buffer.concat(parts),
      });
      return { status: res.statusCode, body: res.json() };
    },
  };
}

export interface Refs {
  demoOrgId: string;
  rnbOrgId: string;
  divOfficeId: string;
  rnbOfficeId: string;
  talukaId: string;
  positions: Record<string, string>;
}

export async function loadRefs(a: Api, token: string): Promise<Refs> {
  const ref = (await a.get('/org/reference', token)).body.data;
  const offices = (await a.get('/offices', token)).body.data as { id: string; code: string }[];
  const positions = (await a.get('/positions', token)).body.data as { id: string; code: string }[];
  return {
    demoOrgId: ref.organizations.find((o: { code: string }) => o.code === 'DEMO-GOV').id,
    rnbOrgId: ref.organizations.find((o: { code: string }) => o.code === 'GJ-RNB').id,
    divOfficeId: offices.find((o) => o.code === 'DEMO-DIV-A')!.id,
    rnbOfficeId: offices.find((o) => o.code === 'RNB-DEMO-DIV')!.id,
    talukaId: ref.jurisdictions.find((j: { code: string }) => j.code === 'DEMO-TALUKA-01').id,
    positions: Object.fromEntries(positions.map((p) => [p.code, p.id])),
  };
}

/** Create a DEMO-GOV project as the officer and submit it (workflow generated, PROPOSAL eligible). */
export async function createAndSubmit(a: Api, token: string, refs: Refs, name: string, cost = '120000000.00'): Promise<string> {
  const c = await a.post('/projects', token, {
    name,
    departmentOrganizationId: refs.demoOrgId,
    owningOfficeId: refs.divOfficeId,
    primaryJurisdictionId: refs.talukaId,
    estimatedCost: cost,
    proposal: { justification: 'Synthetic test project created by the automated suite.' },
  });
  if (c.status !== 201) throw new Error(`create failed: ${JSON.stringify(c.body)}`);
  const id = c.body.data.id as string;
  const s = await a.post(`/projects/${id}/submit`, token);
  if (s.status !== 200) throw new Error(`submit failed: ${JSON.stringify(s.body)}`);
  return id;
}
