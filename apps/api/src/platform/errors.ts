import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ErrorCode } from '@infraflow/shared';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INSUFFICIENT_SCOPE: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  RULE_NOT_VERIFIED: 422,
  AUTHORITY_NOT_RESOLVED: 422,
  INTERNAL_ERROR: 500,
};

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly opts: { fieldErrors?: FieldError[]; sourceRuleId?: string; details?: unknown } = {},
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const unauthenticated = (msg = 'Authentication is required.') => new AppError('UNAUTHENTICATED', msg);
export const forbidden = (msg = 'You do not have permission or scope for this action.') => new AppError('INSUFFICIENT_SCOPE', msg);
export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} was not found.`);
export const conflict = (msg: string, details?: unknown) => new AppError('STATE_CONFLICT', msg, { details });
export const validation = (msg: string, fieldErrors?: FieldError[]) => new AppError('VALIDATION_ERROR', msg, { fieldErrors });
export const authorityNotResolved = (msg: string, details?: unknown) => new AppError('AUTHORITY_NOT_RESOLVED', msg, { details });
export const ruleNotVerified = (msg: string, sourceRuleId?: string) => new AppError('RULE_NOT_VERIFIED', msg, { sourceRuleId });

export function errorEnvelope(requestId: string, code: ErrorCode, message: string, extra: { fieldErrors?: FieldError[]; sourceRuleId?: string } = {}) {
  return { error: { code, message, requestId, ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}), ...(extra.sourceRuleId ? { sourceRuleId: extra.sourceRuleId } : {}) } };
}

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  const requestId = req.id;
  if (err instanceof AppError) {
    return reply.status(err.status).send(errorEnvelope(requestId, err.code, err.message, err.opts));
  }
  if (err instanceof ZodError) {
    const fieldErrors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return reply.status(400).send(errorEnvelope(requestId, 'VALIDATION_ERROR', 'The request is not valid.', { fieldErrors }));
  }
  const pgCode = (err as { code?: string }).code;
  if (pgCode === '23505') {
    return reply.status(409).send(errorEnvelope(requestId, 'STATE_CONFLICT', 'The record conflicts with existing data.'));
  }
  if (pgCode === '23503') {
    return reply.status(400).send(errorEnvelope(requestId, 'VALIDATION_ERROR', 'A referenced record does not exist.'));
  }
  const fe = err as FastifyError;
  if (fe.statusCode && fe.statusCode < 500) {
    const code: ErrorCode = fe.statusCode === 401 ? 'UNAUTHENTICATED' : fe.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR';
    return reply.status(fe.statusCode).send(errorEnvelope(requestId, code, fe.message));
  }
  req.log.error({ err }, 'unhandled error');
  return reply.status(500).send(errorEnvelope(requestId, 'INTERNAL_ERROR', 'An unexpected error occurred.'));
}
