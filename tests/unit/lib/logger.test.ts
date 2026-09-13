import { describe, expect, it } from 'vitest';

import { logError, logger, logRequest } from '@/lib/logger';

describe('lib/logger', () => {
  it('logger.level matches LOG_LEVEL or defaults to info', () => {
    const expected = process.env.LOG_LEVEL ?? 'info';
    expect(logger.level).toBe(expected);
  });

  it('logRequest does not throw', () => {
    expect(() =>
      logRequest({ requestId: 'r1', method: 'GET', path: '/x', status: 200 }),
    ).not.toThrow();
  });

  it('logError does not throw', () => {
    expect(() => logError({ route: '/x' }, 'boom', new Error('kaboom'))).not.toThrow();
  });
});
