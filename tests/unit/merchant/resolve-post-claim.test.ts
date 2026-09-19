import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  query: { device: { findFirst: vi.fn() } },
  update: vi.fn(),
}));
vi.mock('@/db', () => ({ getDb: () => dbMock }));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
  isOwner: (m: { role: string }) => m.role === 'owner',
}));

import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { resolvePostClaim } from '@/domains/merchant/server/service';

function mockUpdate() {
  const set = vi.fn().mockReturnThis();
  const where = vi.fn().mockResolvedValue(undefined);
  dbMock.update.mockReturnValue({ set: set.mockReturnValue({ where }) });
  return { set, where };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolvePostClaim', () => {
  it('binds the caller into the device org when one already exists', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      slug: 'dev-1-slug',
      organizationId: 'org-existing',
    });
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-caller',
      role: 'member',
    });
    mockUpdate();

    const result = await resolvePostClaim('dev-1', 'user-1');
    expect(result).toEqual({ redirectUrl: '/dashboard' });
    expect(dbMock.update).toHaveBeenCalled();
  });

  it('sends an owner with no device org to /option', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-2',
      slug: 'dev-2-slug',
      organizationId: null,
    });
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-2',
      organizationId: 'org-caller',
      role: 'owner',
    });

    const result = await resolvePostClaim('dev-2', 'user-2');
    expect(result).toEqual({ redirectUrl: '/s/dev-2-slug/option' });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('appends the claim-proof token to the /option redirect when one is passed', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-2',
      slug: 'dev-2-slug',
      organizationId: null,
    });
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-2',
      organizationId: 'org-caller',
      role: 'owner',
    });

    const result = await resolvePostClaim('dev-2', 'user-2', 'tok-123');
    expect(result).toEqual({ redirectUrl: '/s/dev-2-slug/option?t=tok-123' });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('binds a member into their own org when the device has none', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-3',
      slug: 'dev-3-slug',
      organizationId: null,
    });
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-3',
      organizationId: 'org-caller',
      role: 'member',
    });
    mockUpdate();

    const result = await resolvePostClaim('dev-3', 'user-3');
    expect(result).toEqual({ redirectUrl: '/dashboard' });
  });

  it('throws when the caller has no membership at all', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-4',
      slug: 'dev-4-slug',
      organizationId: null,
    });
    vi.mocked(getActiveOrganization).mockResolvedValue(null);

    await expect(resolvePostClaim('dev-4', 'user-4')).rejects.toThrow();
  });

  it('throws when the device does not exist', async () => {
    dbMock.query.device.findFirst.mockResolvedValue(undefined);
    await expect(resolvePostClaim('missing', 'user-5')).rejects.toThrow();
  });
});
