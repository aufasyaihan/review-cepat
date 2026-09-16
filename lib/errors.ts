import { z } from 'zod';

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Insufficient permissions') {
    super(403, code, message);
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  if (err instanceof z.ZodError) {
    const message = err.issues[0]?.message ?? 'Invalid request';
    return Response.json({ error: { code: 'VALIDATION', message } }, { status: 400 });
  }
  console.error('[api] unhandled error', err);
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Unexpected error' } },
    { status: 500 },
  );
}
