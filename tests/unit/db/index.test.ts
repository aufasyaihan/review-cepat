import { beforeEach, describe, expect, it, vi } from 'vitest';

const mysql = vi.hoisted(() => ({
  createPool: vi.fn(),
  end: vi.fn(),
}));

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: mysql.createPool,
  },
}));

describe('database connection lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    mysql.createPool.mockReset();
    mysql.end.mockReset();
    mysql.end.mockResolvedValue(undefined);
    mysql.createPool.mockReturnValue({ end: mysql.end });
  });

  it('releases the pool and creates a fresh one after closing', async () => {
    const { closeDb, getDb } = await import('@/db');

    getDb();
    await closeDb();
    getDb();

    expect(mysql.end).toHaveBeenCalledOnce();
    expect(mysql.createPool).toHaveBeenCalledTimes(2);
  });
});
