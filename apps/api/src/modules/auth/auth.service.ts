import bcrypt from 'bcryptjs';
import type { LoginRequest, MeDto } from '@infraflow/shared';
import type { Db } from '../../platform/db.js';
import { withTx } from '../../platform/db.js';
import type { Actor, RequestContext } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { unauthenticated } from '../../platform/errors.js';
import * as repo from './auth.repo.js';

// A fixed hash so unknown-email and wrong-password take comparable time.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8b2cM1sQ8i8mWmYwB8V0pJq5rWzY2S';

export function toMe(actor: Actor): MeDto {
  return {
    user: { id: actor.userId, email: actor.email, displayName: actor.displayName },
    roles: actor.roles,
    permissions: [...actor.permissions].sort(),
    positions: actor.positions.map((p) => ({
      positionId: p.positionId,
      positionCode: p.positionCode,
      designation: p.designation,
      officeId: p.officeId,
      officeName: p.officeName,
      assignmentType: p.assignmentType,
    })),
    contractorIds: actor.contractorIds,
  };
}

/** Verify credentials. Returns the actor id or throws the same UNAUTHENTICATED for every failure mode. */
export async function authenticate(db: Db, ctx: RequestContext, body: LoginRequest): Promise<Actor> {
  const user = await repo.findUserByEmail(db, body.email);
  const ok = await bcrypt.compare(body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !ok || user.status !== 'ACTIVE') {
    await withTx(db, (tx) =>
      audit(tx, ctx, { action: 'auth.login_failed', entityType: 'app_user', metadata: { email: body.email.toLowerCase() } }),
    );
    throw unauthenticated('Invalid email or password.');
  }
  const actor = await repo.loadActor(db, user.id, ctx.now);
  if (!actor) throw unauthenticated('Invalid email or password.');
  await withTx(db, async (tx) => {
    await repo.touchLastLogin(tx, user.id, ctx.now);
    await audit(tx, { ...ctx, actor }, { action: 'auth.login', entityType: 'app_user', entityId: user.id });
  });
  return actor;
}

export class ActorCache {
  private cache = new Map<string, { actor: Actor; expires: number }>();
  constructor(
    private db: Db,
    private ttlMs: number,
  ) {}

  async get(userId: string): Promise<Actor | null> {
    const hit = this.cache.get(userId);
    if (hit && hit.expires > Date.now()) return hit.actor;
    const actor = await repo.loadActor(this.db, userId, new Date());
    if (!actor) {
      this.cache.delete(userId);
      return null;
    }
    if (this.ttlMs > 0) this.cache.set(userId, { actor, expires: Date.now() + this.ttlMs });
    return actor;
  }

  invalidate(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }
}
