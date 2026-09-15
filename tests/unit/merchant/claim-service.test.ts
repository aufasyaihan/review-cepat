import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Membership } from '@/domains/merchant/server/permissions';

const db = vi.hoisted(() => {
  const query = {
    device: { findFirst: vi.fn() },
    member: { findFirst: vi.fn() },
  };
  const updates: Array<{ set: Record<string, unknown> }> = [];
  const update = () => ({
    set: (set: Record<string, unknown>) => ({
      where: () => {
        updates.push({ set });
        return Promise.resolve([]);
      },
    }),
  });
  return { query, update, updates };
});

vi.mock('@/db', () => ({
  getDb: () => db,
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      addMember: vi.fn(),
    },
  },
}));

import { claimWithCode, registerWithClaimCode } from '@/domains/merchant/server/service';
import { auth } from '@/lib/auth';

const signUpEmail = vi.mocked(auth.api.signUpEmail);
const addMember = vi.mocked(auth.api.addMember);

const org = 'org-acme';
const otherOrg = 'org-rival';
const membership: Membership = { id: 'm1', organizationId: org, role: 'member' };

type DeviceRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  organizationId: string | null;
  memberId: string | null;
  boundUserId: string | null;
  createdAt: Date;
};

function deviceRow(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: 'dev-1',
    slug: 'dev-1',
    name: 'Counter 1',
    status: 'UNCLAIMED',
    organizationId: org,
    memberId: null,
    boundUserId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.updates.length = 0;
  db.query.device.findFirst.mockReset();
  db.query.member.findFirst.mockReset();
});

describe('claimWithCode', () => {
  it('binds an unbound device to the caller (code consumed)', async () => {
    db.query.device.findFirst.mockResolvedValue(deviceRow({ boundUserId: null }));
    const result = await claimWithCode('u-caller', membership, '8D3F9KA2');

    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].set).toMatchObject({
      boundUserId: 'u-caller',
      memberId: 'm1',
      organizationId: org,
      status: 'CLAIMED',
    });
    expect(result.status).toBe('CLAIMED');
    expect(result.id).toBe('dev-1');
  });

  it('adopts the caller organization when the device has none', async () => {
    db.query.device.findFirst.mockResolvedValue(
      deviceRow({ organizationId: null, boundUserId: null }),
    );
    const result = await claimWithCode('u-caller', membership, '8D3F9KA2');

    expect(result.status).toBe('CLAIMED');
    expect(db.updates[0].set.organizationId).toBe(org);
  });

  it('rejects a device already bound to another account', async () => {
    db.query.device.findFirst.mockResolvedValue(deviceRow({ boundUserId: 'someone-else' }));

    await expect(claimWithCode('u-caller', membership, '8D3F9KA2')).rejects.toThrow(
      'This code is already linked to another account — sign in with that account instead',
    );
    expect(db.updates).toHaveLength(0);
  });

  it('allows the same user to re-claim their own bound device', async () => {
    db.query.device.findFirst.mockResolvedValue(deviceRow({ boundUserId: 'u-caller' }));
    const result = await claimWithCode('u-caller', membership, '8D3F9KA2');
    expect(result.status).toBe('CLAIMED');
  });

  it('rejects a code from a different organization (cross-org)', async () => {
    db.query.device.findFirst.mockResolvedValue(
      deviceRow({ organizationId: otherOrg, boundUserId: null }),
    );

    await expect(claimWithCode('u-caller', membership, '8D3F9KA2')).rejects.toThrow(
      'This device belongs to another organization',
    );
    expect(db.updates).toHaveLength(0);
  });
});

describe('registerWithClaimCode', () => {
  const input = {
    claimCode: '8D3F9KA2',
    name: 'New User',
    email: 'new@example.com',
    password: 'password-123',
  };

  it('creates the account, joins the org, and binds the device', async () => {
    db.query.device.findFirst.mockResolvedValue(deviceRow({ boundUserId: null }));
    signUpEmail.mockResolvedValue({ user: { id: 'u-new' } } as never);
    db.query.member.findFirst.mockResolvedValue({ id: 'm-new' });

    const result = await registerWithClaimCode(input);

    expect(signUpEmail).toHaveBeenCalledWith({
      body: { name: input.name, email: input.email, password: input.password },
    });
    expect(addMember).toHaveBeenCalledWith({
      body: { userId: 'u-new', organizationId: org, role: 'member' },
    });
    const deviceSet = db.updates.find((u) => u.set.boundUserId === 'u-new');
    expect(deviceSet?.set).toMatchObject({ memberId: 'm-new', status: 'CLAIMED' });
    expect(result).toEqual({ role: 'MERCHANT', deviceId: 'dev-1', slug: 'dev-1' });
  });

  it('rejects a used code without creating an account', async () => {
    db.query.device.findFirst.mockResolvedValue(deviceRow({ boundUserId: 'u-owner' }));

    await expect(registerWithClaimCode(input)).rejects.toThrow(
      'This code is already linked to an account',
    );
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(db.updates).toHaveLength(0);
  });

  it('rejects a device that belongs to no organization', async () => {
    db.query.device.findFirst.mockResolvedValue(
      deviceRow({ organizationId: null, boundUserId: null }),
    );

    await expect(registerWithClaimCode(input)).rejects.toThrow(
      'This device is not linked to a reseller organization yet — contact the seller',
    );
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});
