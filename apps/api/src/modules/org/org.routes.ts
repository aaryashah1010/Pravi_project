import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './org.service.js';

export async function orgRoutes(app: FastifyInstance) {
  const authed = { preHandler: app.auth };

  app.get('/org/tree', authed, async () => service.getOrgTree(app.db));

  app.get('/offices', authed, async () => (await service.listOffices(app.db)).map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    officeType: o.office_type,
    organizationId: o.organization_id,
    organizationCode: o.organization_code,
    organizationName: o.organization_name,
    parentOfficeId: o.parent_office_id,
  })));

  app.get('/positions', authed, async (req) => {
    const { officeId } = z.object({ officeId: z.string().uuid().optional() }).parse(req.query);
    return (await service.listPositions(app.db, officeId)).map((p) => ({
      id: p.id,
      code: p.position_code,
      designation: p.designation,
      positionTypeCode: p.position_type_code,
      displayName: p.display_name,
      officeId: p.office_id,
      officeName: p.office_name,
      status: p.status,
      holder: p.holder_user_id ? { userId: p.holder_user_id, displayName: p.holder_name } : null,
    }));
  });

  app.get('/org/reference', authed, async () => {
    const [organizations, jurisdictions, projectTypes] = await Promise.all([
      service.listOrganizations(app.db),
      service.listJurisdictions(app.db),
      service.listProjectTypes(app.db),
    ]);
    return { organizations, jurisdictions, projectTypes };
  });

  app.get('/users', { preHandler: app.perm('workflow.manage') }, async () => service.listUsers(app.db));
}
