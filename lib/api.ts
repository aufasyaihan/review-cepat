import { randomUUID } from 'node:crypto';
import { toErrorResponse } from '@/lib/errors';
import { logError, logRequest } from '@/lib/logger';

export type ApiRouteContext = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: ApiRouteContext) => Promise<unknown>;

/**
 * Wraps a domain handler with structured request logging (constitution VI)
 * and JSON error translation. Handlers only translate HTTP into domain
 * services (constitution III).
 */
export function apiRoute(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, fn: Handler) {
  return async (req: Request, ctx: ApiRouteContext): Promise<Response> => {
    const requestId = randomUUID();
    const start = Date.now();
    try {
      const data = await fn(req, ctx);
      logRequest({
        requestId,
        method,
        path,
        status: 200,
        durationMs: Date.now() - start,
      });
      if (data instanceof Response) return data;
      return Response.json(data);
    } catch (err) {
      const res = toErrorResponse(err);
      logRequest({
        requestId,
        method,
        path,
        status: res.status,
        durationMs: Date.now() - start,
      });
      logError({ requestId, method, path }, 'api error', err);
      return res;
    }
  };
}
