import { randomUUID } from 'node:crypto';

export interface ActorRole {
  code: string;
  organizationId: string | null;
  officeId: string | null;
  jurisdictionId: string | null;
}

export interface ActorPosition {
  positionId: string;
  positionCode: string;
  positionTypeId: string;
  positionTypeCode: string;
  designation: string;
  officeId: string;
  officeName: string;
  organizationId: string;
  assignmentType: string;
}

export interface Actor {
  userId: string;
  email: string;
  displayName: string;
  roles: ActorRole[];
  permissions: Set<string>;
  positions: ActorPosition[];
  contractorIds: string[];
}

/**
 * Every service function takes a RequestContext. Business timestamps MUST use ctx.now
 * (never new Date()/now()) so the scenario seeder can backdate history consistently.
 */
export interface RequestContext {
  actor: Actor | null;
  requestId: string;
  now: Date;
}

export function systemContext(now: Date = new Date(), requestId: string = `sys-${randomUUID()}`): RequestContext {
  return { actor: null, requestId, now };
}

export function actorContext(actor: Actor, now: Date = new Date(), requestId: string = `ctx-${randomUUID()}`): RequestContext {
  return { actor, requestId, now };
}

export function can(actor: Actor | null, permission: string): boolean {
  return !!actor && actor.permissions.has(permission);
}

/** Highest-privilege primary role code for audit display. */
export function roleCodeFor(actor: Actor | null): string {
  if (!actor) return 'SYSTEM';
  return actor.roles[0]?.code ?? 'NONE';
}

/** True if the actor holds a global (organisation-unscoped) non-contractor role. */
export function hasGlobalScope(actor: Actor): boolean {
  return actor.roles.some((r) => r.organizationId === null && r.code !== 'CONTRACTOR');
}
