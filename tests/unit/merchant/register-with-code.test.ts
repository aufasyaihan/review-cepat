import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => {
  const db = {
    query: {
      device: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      member: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      organization: { findMany: vi.fn().mockResolvedValue([]) },
      merchantProfile: { findFirst: vi.fn().mockResolvedValue(null) },
      destination: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      place: { findFirst: vi.fn().mockResolvedValue(null) },
      scanEvent: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
  };
  return { getDb: () => db };
});

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      addMember: vi.fn(),
    },
  },
}));

import { getDb } from '@/db';
import { registerWithClaimCode } from '@/domains/merchant/server/service';
import { auth } from '@/lib/auth';
import { hashClaimCode } from '@/lib/codes';

type MockFn = ReturnType<typeof vi.fn>;
const q = (table: 'device' | 'member') => (getDb() as any).query[table];

const now = new Date('2025-07-01T00:00:00Z');
const CODE = 'TESTCODE123456';

function deviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-1',
    slug: 'slug-ones',
    name: 'Device',
    status: 'UNCLAIMED',
    organizationId: 'org-1',
    memberId: null,
    boundUserId: null,
    claimCodeHash: hashClaimCode(CODE),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  q('device').findFirst.mockResolvedValue(null);
  q('member').findFirst.mockResolvedValue(null);
  q('member').findMany.mockResolvedValue([]);
});

describe('registerWithClaimCode (FR-024)', () => {
  it('creates an account, joins the device org as member, and binds the device', async () => {
    q('device')
      .findFirst.mockResolvedValueOnce(deviceRow()) // claim lookup
      .mockResolvedValueOnce(deviceRow({ status: 'CLAIMED' }));
    q('member').findFirst.mockResolvedValue({
      id: 'm1',
      organizationId: 'org-1',
      userId: 'new-u1',
      role: 'member',
    });
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { id: 'new-u1', name: 'Sub', email: 'sub@x.com' },
    } as never);
    vi.mocked(auth.api.addMember).mockResolvedValue({} as never);

    const result = await registerWithClaimCode({
      claimCode: CODE,
      name: 'Sub',
      email: 'sub@x.com',
      password: 'password123',
    });

    expect(result).toEqual({ role: 'MERCHANT', deviceId: 'dev-1', slug: 'slug-ones' });
    expect(auth.api.signUpEmail).toHaveBeenCalled();
    expect(auth.api.addMember).toHaveBeenCalledWith({
      body: { userId: 'new-u1', organizationId: 'org-1', role: 'member' },
    });
  });

  it('rejects a code already bound to another account', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow({ boundUserId: 'someone' }));
    await expect(
      registerWithClaimCode({
        claimCode: CODE,
        name: 'Sub',
        email: 's@x.com',
        password: 'password123',
      }),
    ).rejects.toThrow('already linked to an account');
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  it('rejects a device with no organization binding', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow({ organizationId: null }));
    await expect(
      registerWithClaimCode({
        claimCode: CODE,
        name: 'Sub',
        email: 's@x.com',
        password: 'password123',
      }),
    ).rejects.toThrow('not linked to a reseller organization');
  });

  it('rejects an unknown claim code', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(
      registerWithClaimCode({
        claimCode: 'ZZZZZZ',
        name: 'Sub',
        email: 's@x.com',
        password: 'password123',
      }),
    ).rejects.toThrow('Claim code not found');
  });

  it('fails when signUp returns no user', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow());
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({ user: null } as never);
    await expect(
      registerWithClaimCode({
        claimCode: CODE,
        name: 'Sub',
        email: 's@x.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({ status: 500, code: 'SIGNUP_FAILED' });
  });

  it('propagates a signUp failure', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow());
    vi.mocked(auth.api.signUpEmail).mockRejectedValue(new Error('email taken'));
    await expect(
      registerWithClaimCode({
        claimCode: CODE,
        name: 'Sub',
        email: 's@x.com',
        password: 'password123',
      }),
    ).rejects.toThrow('email taken');
  });

  it('still binds the device when the membership lookup returns null', async () => {
    q('device')
      .findFirst.mockResolvedValueOnce(deviceRow())
      .mockResolvedValueOnce(deviceRow({ status: 'CLAIMED' }));
    q('member').findFirst.mockResolvedValue(null);
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({ user: { id: 'new-u1' } } as never);
    vi.mocked(auth.api.addMember).mockResolvedValue({} as never);
    const result = await registerWithClaimCode({
      claimCode: CODE,
      name: 'Sub',
      email: 's@x.com',
      password: 'password123',
    });
    expect(result.deviceId).toBe('dev-1');
  });
});
