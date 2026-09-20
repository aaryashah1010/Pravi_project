import type { Queryable } from './db.js';
import type { RequestContext } from './context.js';

export interface DomainEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorPositionId?: string | null;
}

/**
 * Transactional outbox insert (doc 33/event-model). Business state is committed first; the dispatcher publishes later.
 * The envelope carries actor identity so consumers (notifications) need no extra lookups.
 */
export async function emit(tx: Queryable, ctx: RequestContext, e: DomainEventInput): Promise<string> {
  const payload = {
    actorUserId: ctx.actor?.userId ?? null,
    actorPositionId: e.actorPositionId ?? null,
    requestId: ctx.requestId,
    ...e.payload,
  };
  const r = await tx.query<{ id: string }>(
    `INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, event_version, payload, occurred_at)
     VALUES ($1,$2,$3,1,$4,$5) RETURNING id`,
    [e.aggregateType, e.aggregateId, e.eventType, JSON.stringify(payload), ctx.now],
  );
  return r.rows[0]!.id;
}
