import { logger } from '@/lib/logger';

/**
 * Next.js instrumentation — server startup + error-context hooks.
 * Request-level structured logging lives in lib/api.ts and services.
 */
export async function register() {
  logger.info({ env: process.env.NODE_ENV }, 'server starting');
}

export async function onRequestError(
  err: { message?: string; name?: string },
  request: { url: string },
) {
  logger.error(
    { err: { message: err.message, name: err.name }, url: request.url },
    'request error',
  );
}
