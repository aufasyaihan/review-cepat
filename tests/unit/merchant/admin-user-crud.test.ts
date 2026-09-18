import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => {
  const listRows = vi.fn().mockResolvedValue([]);
  const deviceCounts = vi.fn().mockResolvedValue([]);
  const memberCount = vi.fn().mockResolvedValue([{ cnt: 0 }]);
  const ownerRows = vi.fn().mockResolvedValue([]);
  const steps: Array<{ kind: string; name: string; arg: unknown }> = [];
  const updates: Array<{ table: unknown; set: unknown }> = [];
  const deletes: Array<{ table: unknown }> = [];
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const query = {
    organization: { findFirst: vi.fn().mockResolvedValue(null) },
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    member: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const methods = ['innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy'];

  function select(fields: Record<string, unknown>) {
    const keys = Object.keys(fields).sort().join(',');
    const kind =
      keys === 'cnt,memberId'
        ? 'deviceCounts'
        : keys === 'cnt'
          ? 'memberCount'
          : keys === 'id'
            ? 'ownerRows'
            : 'listRows';
    const resolver =
      kind === 'deviceCounts'
        ? deviceCounts
        : kind === 'memberCount'
          ? memberCount
          : kind === 'ownerRows'
            ? ownerRows
            : listRows;
    let proxy: any;
    const chain = () => proxy;
    proxy = new Proxy(chain, {
      get(_t, prop: string) {
        if (prop === 'then') return (res: (v: unknown) => unknown) => res(resolver());
        if (prop === 'from')
          return (table: unknown) => {
            steps.push({ kind, name: 'from', arg: table });
            return proxy;
          };
        if (methods.includes(prop))
          return (arg: unknown) => {
            steps.push({ kind, name: prop, arg });
            return proxy;
          };
        return undefined;
      },
    });
    return proxy;
  }

  const db = {
    query,
    select,
    update: (table: unknown) => ({
      set: (values: unknown) => {
        updates.push({ table, set: values });
        return { where: () => undefined };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        return undefined;
      },
    }),
    delete: (table: unknown) => {
      deletes.push({ table });
      return { where: () => undefined };
    },
  };
  return {
    db,
    mocks: { listRows, deviceCounts, memberCount, ownerRows },
    log: { steps, updates, deletes, inserts },
  };
});

const authMocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  linkAccount: vi.fn(),
  hash: vi.fn().mockResolvedValue('hashed-password'),
}));

vi.mock('@/db', () => ({ getDb: () => dbMocks.db }));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: { signUpEmail: vi.fn() },
    $context: Promise.resolve({
      internalAdapter: {
        createUser: authMocks.createUser,
        linkAccount: authMocks.linkAccount,
      },
      password: { hash: authMocks.hash },
    }),
  },
}));

import { account, device, member, session, user } from '@/db/schema';
import {
  createUser,
  deactivateUser,
  listUsers,
  updateUser,
} from '@/domains/merchant/server/service';

const { listRows, deviceCounts, memberCount, ownerRows } = dbMocks.mocks;
const { steps, updates, deletes, inserts } = dbMocks.log;

type MockFn = ReturnType<typeof vi.fn>;
const qMember = () => dbMocks.db.query.member.findFirst as MockFn;
const qOrg = () => dbMocks.db.query.organization.findFirst as MockFn;
const qUser = () => dbMocks.db.query.user.findFirst as MockFn;

const memberRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  userId: 'u1',
  organizationId: 'org-1',
  role: 'owner',
  organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
  user: { id: 'u1', name: 'Owner One', email: 'owner1@acme.io' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  listRows.mockResolvedValue([]);
  deviceCounts.mockResolvedValue([]);
  memberCount.mockResolvedValue([{ cnt: 0 }]);
  ownerRows.mockResolvedValue([]);
  qMember().mockResolvedValue(null);
  qOrg().mockResolvedValue(null);
  qUser().mockResolvedValue(null);
  authMocks.createUser.mockResolvedValue({ id: 'new-user' });
  authMocks.linkAccount.mockResolvedValue(undefined);
  authMocks.hash.mockResolvedValue('hashed-password');
  steps.length = 0;
  updates.length = 0;
  deletes.length = 0;
  inserts.length = 0;
});

describe('listUsers (FR-055 server-driven pagination)', () => {
  it('returns rows with deviceCount and pagination fields', async () => {
    listRows.mockResolvedValue([
      {
        memberId: 'm1',
        userId: 'u1',
        role: 'owner',
        organizationId: 'org-1',
        name: 'Owner One',
        email: 'owner1@acme.io',
        platformRole: 'MERCHANT',
        organizationName: 'Org One',
      },
      {
        memberId: 'm2',
        userId: 'u2',
        role: 'member',
        organizationId: 'org-1',
        name: 'Sub',
        email: 'sub@acme.io',
        platformRole: 'MERCHANT',
        organizationName: 'Org One',
      },
    ]);
    deviceCounts.mockResolvedValue([{ memberId: 'm2', cnt: 3 }]);
    memberCount.mockResolvedValue([{ cnt: 2 }]);

    const result = await listUsers({});

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.rows.find((r) => r.id === 'm2')).toMatchObject({
      role: 'member',
      deviceCount: 3,
      organizationName: 'Org One',
    });
  });

  it('clamps page/limit via pageParams', async () => {
    const result = await listUsers({ page: 0, limit: 500 });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });

  it('adds a WHERE condition when q is provided (trimmed)', async () => {
    await listUsers({ q: '  Acme  ' });
    const whereSteps = steps.filter((s) => s.kind === 'listRows' && s.name === 'where');
    expect(whereSteps).toHaveLength(1);
    expect(whereSteps[0].arg).toBeTruthy();
  });

  it('omits the WHERE condition when no q / organizationId is given', async () => {
    await listUsers({});
    const whereSteps = steps.filter((s) => s.kind === 'listRows' && s.name === 'where');
    expect(whereSteps).toHaveLength(1);
    expect(whereSteps[0].arg).toBeUndefined();
  });

  it('adds a WHERE condition when organizationId is provided', async () => {
    await listUsers({ organizationId: 'org-2' });
    const whereSteps = steps.filter((s) => s.kind === 'listRows' && s.name === 'where');
    expect(whereSteps[0].arg).toBeTruthy();
  });

  it('applies the same filter to the total count query', async () => {
    await listUsers({ q: 'acme' });
    const countWhere = steps.find((s) => s.kind === 'memberCount' && s.name === 'where');
    expect(countWhere?.arg).toBeTruthy();
  });
});

describe('createUser (FR-052, admin-provisioned, no invitation)', () => {
  const input = {
    name: 'New User',
    email: 'new@acme.io',
    password: 'password123',
    organizationId: 'org-1',
    role: 'member' as const,
  };

  it('rejects when the organization does not exist', async () => {
    await expect(createUser(input)).rejects.toMatchObject({
      status: 404,
      code: 'ORGANIZATION_NOT_FOUND',
    });
    expect(authMocks.createUser).not.toHaveBeenCalled();
  });

  it('rejects when the email is already registered', async () => {
    qOrg().mockResolvedValue({ id: 'org-1', name: 'Org One' });
    qUser().mockResolvedValue({ id: 'other', email: input.email });
    await expect(createUser(input)).rejects.toMatchObject({ status: 409, code: 'EMAIL_IN_USE' });
    expect(authMocks.createUser).not.toHaveBeenCalled();
  });

  it('creates the account via the internal adapter (no session cookie) and inserts the membership', async () => {
    qOrg().mockResolvedValue({ id: 'org-1', name: 'Org One' });
    qMember().mockResolvedValue(
      memberRow({
        id: 'm-new',
        role: 'member',
        userId: 'new-user',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: { id: 'new-user', name: 'New User', email: 'new@acme.io' },
      }),
    );

    const result = await createUser(input);

    expect(authMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: input.name,
        email: input.email,
        emailVerified: true,
        role: 'MERCHANT',
        status: 'ACTIVE',
      }),
      { method: 'admin' },
    );
    expect(authMocks.hash).toHaveBeenCalledWith(input.password);
    expect(authMocks.linkAccount).toHaveBeenCalledWith({
      providerId: 'credential',
      accountId: 'new-user',
      password: 'hashed-password',
      userId: 'new-user',
    });
    const memberInsert = inserts.find((i) => i.table === member);
    expect(memberInsert?.values).toMatchObject({
      organizationId: 'org-1',
      userId: 'new-user',
      role: 'member',
    });
    expect(result).toMatchObject({ id: 'm-new', role: 'member', email: 'new@acme.io' });
  });
});

describe('updateUser (FR-053, rename / email / role / org move)', () => {
  it('rejects when the member is not found', async () => {
    await expect(updateUser({ memberId: 'missing' })).rejects.toMatchObject({
      status: 404,
      code: 'MEMBER_NOT_FOUND',
    });
  });

  it('renames the user when the name differs', async () => {
    qMember()
      .mockResolvedValueOnce(memberRow())
      .mockResolvedValueOnce(
        memberRow({ user: { id: 'u1', name: 'Renamed', email: 'owner1@acme.io' } }),
      );

    const result = await updateUser({ memberId: 'm1', name: 'Renamed' });

    expect(updates.find((u) => u.table === user)?.set).toMatchObject({ name: 'Renamed' });
    expect(result.name).toBe('Renamed');
  });

  it('changes the email and keeps the email credential in sync', async () => {
    qMember().mockResolvedValueOnce(memberRow()).mockResolvedValueOnce(memberRow());
    qUser().mockResolvedValue(null);

    await updateUser({ memberId: 'm1', email: 'new@acme.io' });

    expect(updates.find((u) => u.table === user)?.set).toMatchObject({ email: 'new@acme.io' });
    expect(updates.find((u) => u.table === account)?.set).toMatchObject({
      accountId: 'new@acme.io',
    });
  });

  it('rejects an email that belongs to another account', async () => {
    qMember().mockResolvedValueOnce(memberRow());
    qUser().mockResolvedValue({ id: 'someone-else', email: 'new@acme.io' });

    await expect(updateUser({ memberId: 'm1', email: 'new@acme.io' })).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_IN_USE',
    });
  });

  it('rejects demoting the last owner of an organization', async () => {
    qMember().mockResolvedValueOnce(memberRow());
    ownerRows.mockResolvedValue([{ id: 'm1' }]);

    await expect(updateUser({ memberId: 'm1', role: 'member' })).rejects.toMatchObject({
      status: 409,
      code: 'LAST_OWNER',
    });
  });

  it('allows demoting an owner when another owner exists', async () => {
    qMember()
      .mockResolvedValueOnce(memberRow())
      .mockResolvedValueOnce(memberRow({ role: 'member' }));
    ownerRows.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

    const result = await updateUser({ memberId: 'm1', role: 'member' });

    expect(updates.find((u) => u.table === member)?.set).toMatchObject({ role: 'member' });
    expect(result.role).toBe('member');
  });

  it('rejects moving the last owner to another merchant', async () => {
    qMember().mockResolvedValueOnce(memberRow());
    ownerRows.mockResolvedValue([{ id: 'm1' }]);

    await expect(updateUser({ memberId: 'm1', organizationId: 'org-2' })).rejects.toMatchObject({
      status: 409,
      code: 'LAST_OWNER',
    });
  });

  it('moves a non-last owner to another org: new membership, devices follow, old row deleted', async () => {
    qMember()
      .mockResolvedValueOnce(memberRow()) // lookup by memberId
      .mockResolvedValueOnce(null) // no existing membership in target org
      .mockResolvedValueOnce(
        memberRow({
          id: 'm-new',
          organizationId: 'org-2',
          organization: { id: 'org-2', name: 'Org Two', slug: 'org-two' },
        }),
      ); // reload after move
    ownerRows.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

    const result = await updateUser({ memberId: 'm1', organizationId: 'org-2' });

    const memberInsert = inserts.find((i) => i.table === member);
    expect(memberInsert?.values).toMatchObject({
      organizationId: 'org-2',
      userId: 'u1',
      role: 'owner',
    });
    const newMemberId = (memberInsert!.values as { id: string }).id;
    expect(updates.find((u) => u.table === device)?.set).toMatchObject({ memberId: newMemberId });
    expect(deletes.some((d) => d.table === member)).toBe(true);
    expect(result.organizationName).toBe('Org Two');
  });
});

describe('deactivateUser (FR-052: membership removed + account deactivated)', () => {
  it('rejects when the member is not found', async () => {
    await expect(deactivateUser('missing')).rejects.toMatchObject({
      status: 404,
      code: 'MEMBER_NOT_FOUND',
    });
  });

  it('rejects deactivating the last owner', async () => {
    qMember().mockResolvedValue(memberRow());
    ownerRows.mockResolvedValue([{ id: 'm1' }]);

    await expect(deactivateUser('m1')).rejects.toMatchObject({ status: 409, code: 'LAST_OWNER' });
  });

  it('deletes the membership and deactivates the platform account with sessions revoked', async () => {
    qMember().mockResolvedValue(memberRow());
    ownerRows.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

    await expect(deactivateUser('m1')).resolves.toBeUndefined();

    expect(deletes.some((d) => d.table === member)).toBe(true);
    expect(deletes.some((d) => d.table === session)).toBe(true);
    expect(updates.find((u) => u.table === user)?.set).toMatchObject({ status: 'DEACTIVATED' });
  });
});
