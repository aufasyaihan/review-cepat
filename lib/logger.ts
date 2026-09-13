import pino from 'pino';

/**
 * Pino is the only logging library (constitution VI). Server-side only.
 * Child/log helpers are used by route handlers and domain services.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['password', '*.password', 'authorization'],
});

export type RequestLogContext = {
  requestId: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  actorId?: string;
  deviceSlug?: string;
  outcome?: string;
};

export function logRequest(ctx: RequestLogContext) {
  const { requestId, ...rest } = ctx;
  logger.child({ requestId }).info({ ...rest }, 'request');
}

export function logError(context: Record<string, unknown>, message: string, err: unknown) {
  logger.error({ ...context, err }, message);
}
