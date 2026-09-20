import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { AppConfig } from '../config.js';
import type { Db } from './db.js';
import type { RequestContext } from './context.js';
import { forbidden, unauthenticated } from './errors.js';
import type { ActorCache } from '../modules/auth/auth.service.js';
import type { AiRuntime } from '../modules/ai/ai.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext;
  }
  interface FastifyInstance {
    db: Db;
    config: AppConfig;
    actors: ActorCache;
    ai: AiRuntime;
    /** Require a valid JWT and load the actor. */
    auth: preHandlerAsyncHookHandler;
    /** Require ANY of the listed permissions (implies auth). */
    perm: (...codes: string[]) => preHandlerAsyncHookHandler;
  }
}

/** Sends `{data, meta:{requestId}}` for every successful JSON payload; errors are already enveloped. */
export function registerEnvelope(app: FastifyInstance): void {
  app.addHook('onRequest', async (req) => {
    let now = new Date();
    const demo = req.headers['x-demo-now'];
    if (app.config.allowDemoClock && typeof demo === 'string' && !Number.isNaN(Date.parse(demo))) now = new Date(demo);
    req.ctx = { actor: null, requestId: req.id, now };
  });
  app.addHook('preSerialization', async (req: FastifyRequest, _reply: FastifyReply, payload: unknown) => {
    if (payload && typeof payload === 'object' && 'error' in (payload as Record<string, unknown>)) return payload;
    return { data: payload ?? null, meta: { requestId: req.id } };
  });
}

export function registerGuards(app: FastifyInstance): void {
  const auth: preHandlerAsyncHookHandler = async (req) => {
    let sub: string;
    try {
      const decoded = await req.jwtVerify<{ sub: string }>();
      sub = decoded.sub;
    } catch {
      throw unauthenticated('Missing or invalid access token.');
    }
    const actor = await app.actors.get(sub);
    if (!actor) throw unauthenticated('The account is not active.');
    req.ctx = { ...req.ctx, actor };
  };
  app.decorate('auth', auth);
  app.decorate('perm', (...codes: string[]): preHandlerAsyncHookHandler => {
    return async function (this: FastifyInstance, req, reply) {
      await auth.call(this, req, reply);
      const actor = req.ctx.actor!;
      if (!codes.some((c) => actor.permissions.has(c))) {
        throw forbidden(`Requires permission: ${codes.join(' or ')}.`);
      }
    };
  });
}
