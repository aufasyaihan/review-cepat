import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: (_lhs: unknown, rhs: unknown) => rhs,
}));

import { getDb } from '@/db';
import { ensurePermissions, PERMISSION_ROWS } from '@/db/seed/permissions';

const getDbMock = vi.mocked(getDb);

function makeDb() {
  const inserted: Array<Record<string, unknown>> = [];
  const existing = new Map<string, string>();
  const db = {
    query: {
      permission: {
        findFirst: vi.fn(async ({ where }: { where: unknown }) => {
          const path = where as string;
          const id = existing.get(path);
          return id ? { id } : undefined;
        }),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: async (row: Record<string, unknown>) => {
        inserted.push(row);
        existing.set(row.path as string, row.id as string);
      },
    }),
  };
  return { db, inserted, existing };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensurePermissions', () => {
  it('seeds nav + API rows with parentId resolved from the serving page', async () => {
    const { db, inserted } = makeDb();
    getDbMock.mockReturnValue(db as never);

    await ensurePermissions(db as never);

    const navRows = inserted.filter((r) => r.isMenu === true);
    const apiRows = inserted.filter((r) => r.isMenu === false);

    expect(navRows.length).toBeGreaterThanOrEqual(7);
    expect(apiRows.length).toBeGreaterThanOrEqual(10);
    expect(apiRows.every((r) => r.icon === null)).toBe(true);

    const createDevice = apiRows.find((r) => r.path === '/api/device/create');
    expect(createDevice?.label).toBe('api.create_device');
    const parentId = createDevice?.parentId;
    expect(parentId).toBeTypeOf('string');

    const devicesNew = navRows.find((r) => r.path === '/devices/new');
    expect(devicesNew?.id).toBe(parentId);

    const invite = apiRows.find((r) => r.path === '/api/member/invite');
    const userMgmt = navRows.find((r) => r.path === '/user-management');
    expect(invite?.parentId).toBe(userMgmt?.id);
  });

  it('is idempotent by path: existing rows are not re-inserted', async () => {
    const { db, inserted } = makeDb();
    getDbMock.mockReturnValue(db as never);

    await ensurePermissions(db as never);
    const firstCount = inserted.length;
    await ensurePermissions(db as never);
    expect(inserted.length).toBe(firstCount);
  });

  it('skips parentId when the parent page has no row yet (defensive)', async () => {
    const original = [...PERMISSION_ROWS];
    (PERMISSION_ROWS as Array<(typeof PERMISSION_ROWS)[number]>).splice(0, PERMISSION_ROWS.length, {
      path: '/api/x',
      label: 'api.x',
      icon: '',
      isMenu: false,
      roles: ['ADMIN'],
      sort: 0,
      parentPath: '/never-exists',
    });

    const { db, inserted } = makeDb();
    getDbMock.mockReturnValue(db as never);
    await ensurePermissions(db as never);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].parentId).toBeNull();
    (PERMISSION_ROWS as Array<(typeof PERMISSION_ROWS)[number]>).splice(
      0,
      PERMISSION_ROWS.length,
      ...original,
    );
  });
});
