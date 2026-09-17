import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: (_lhs: unknown, rhs: unknown) => rhs,
  isNull: () => null,
}));

import { getDb } from '@/db';
import { ensurePermissions, MASTER_ROLE_ROWS, PERMISSION_ROWS } from '@/db/seed/permissions';

const getDbMock = vi.mocked(getDb);

type Row = Record<string, unknown>;

const tableName = (t: object) => {
  interface NamedTable {
    [key: symbol]: string;
  }
  return (t as NamedTable)[Symbol.for('drizzle:Name')] ?? '';
};

function makeDb() {
  const perms: Row[] = [];
  const roles: Row[] = [];
  const links: Row[] = [];
  const permExisting = new Map<string, string>();
  const roleExisting = new Map<string, string>();
  const linkExisting = new Set<string>();

  const findFirst = vi.fn(async ({ where }: { where?: unknown }) => {
    if (typeof where === 'function') {
      const eqOp = (_l: unknown, r: unknown) => r;
      const isNullOp = () => null;
      const andOp = (...args: unknown[]) => args;
      const resolved = (where as (t: object, ops: object) => unknown)(
        {},
        {
          and: andOp,
          eq: eqOp,
          isNull: isNullOp,
        },
      ) as unknown[];
      const key = resolved.map((v) => String(v ?? '')).join('|');
      return linkExisting.has(key) ? { id: key } : undefined;
    }
    const id = permExisting.get(where as string) ?? roleExisting.get(where as string);
    return id ? { id } : undefined;
  });

  const insert = vi.fn((t: object) => ({
    values: async (row: Row) => {
      const name = tableName(t);
      if (name === 'permission') {
        perms.push(row);
        permExisting.set(row.path as string, row.id as string);
      } else if (name === 'master_role') {
        roles.push(row);
        roleExisting.set(row.name as string, row.id as string);
      } else if (name === 'role_permission') {
        links.push(row);
        linkExisting.add(`${row.roleId}|${row.permissionId}|${String(row.scope ?? '')}`);
      }
    },
  }));

  const db = {
    query: { permission: { findFirst }, masterRole: { findFirst }, rolePermission: { findFirst } },
    insert,
  };
  return { db: db as never, perms, roles, links };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensurePermissions', () => {
  it('seeds master_role with ADMIN and MERCHANT only', async () => {
    const { db, roles } = makeDb();
    getDbMock.mockReturnValue(db as never);

    await ensurePermissions(db as never);

    expect(MASTER_ROLE_ROWS).toEqual(['ADMIN', 'MERCHANT']);
    expect(roles.map((r) => r.name).sort()).toEqual(['ADMIN', 'MERCHANT']);
  });

  it('seeds nav + API rows with parentId resolved from the serving page and no roles column', async () => {
    const { db, perms } = makeDb();
    getDbMock.mockReturnValue(db as never);

    await ensurePermissions(db as never);

    const navRows = perms.filter((r) => r.isMenu === true);
    const apiRows = perms.filter((r) => r.isMenu === false);

    expect(navRows.length).toBeGreaterThanOrEqual(6);
    expect(apiRows.length).toBeGreaterThanOrEqual(13);
    expect(apiRows.every((r) => r.icon === null)).toBe(true);
    expect(perms.every((r) => !('roles' in r))).toBe(true);

    const createDevice = apiRows.find((r) => r.path === '/api/device/create');
    expect(createDevice?.label).toBe('api.create_device');
    const parentId = createDevice?.parentId;
    expect(parentId).toBeTypeOf('string');

    const devicesNav = navRows.find((r) => r.path === '/devices');
    expect(devicesNav?.id).toBe(parentId);
  });

  it('links ADMIN (null scope) for admin-accessible rows and MERCHANT for every row', async () => {
    const { db, links } = makeDb();
    getDbMock.mockReturnValue(db as never);

    await ensurePermissions(db as never);

    // Every permission gets a MERCHANT link; ADMIN links exist only where the
    // seed intentionally grants admin nav/access (never /devices/claim etc.).
    expect(links).toHaveLength(PERMISSION_ROWS.length + 21);
    expect(links.some((l) => l.scope === 'owner')).toBe(true);
  });

  it('is idempotent by (role, permission, scope): existing rows are not re-inserted', async () => {
    const { db, perms, roles, links } = makeDb();
    getDbMock.mockReturnValue(db as never);

    await ensurePermissions(db as never);
    const counts = { perms: perms.length, roles: roles.length, links: links.length };
    await ensurePermissions(db as never);
    expect(perms.length).toBe(counts.perms);
    expect(roles.length).toBe(counts.roles);
    expect(links.length).toBe(counts.links);
  });

  it('skips parentId when the parent page has no row yet (defensive)', async () => {
    const original = [...PERMISSION_ROWS];
    (PERMISSION_ROWS as Array<(typeof PERMISSION_ROWS)[number]>).splice(0, PERMISSION_ROWS.length, {
      path: '/api/x',
      label: 'api.x',
      icon: '',
      isMenu: false,
      sort: 0,
      parentPath: '/never-exists',
    });

    const { db, perms } = makeDb();
    getDbMock.mockReturnValue(db as never);
    await ensurePermissions(db as never);

    const apiX = perms.find((r) => r.path === '/api/x');
    expect(apiX?.parentId).toBeNull();
    (PERMISSION_ROWS as Array<(typeof PERMISSION_ROWS)[number]>).splice(
      0,
      PERMISSION_ROWS.length,
      ...original,
    );
  });
});
