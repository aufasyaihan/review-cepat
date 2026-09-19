import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  query: { organization: { findFirst: vi.fn() } },
  insert: vi.fn(),
}));
vi.mock('@/db', () => ({ getDb: () => dbMock }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { createOrganization: vi.fn() } },
}));

import {
  createOrganizationForUser,
  createOrganizationShell,
} from '@/domains/merchant/server/service';
import { auth } from '@/lib/auth';

function chainableInsert() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.insert.mockReturnValue(chainableInsert());
});

describe('createOrganizationForUser slug uniqueness', () => {
  it('creates the org with the first unslugged-collision candidate', async () => {
    dbMock.query.organization.findFirst.mockResolvedValueOnce(null);
    vi.mocked(auth.api.createOrganization).mockResolvedValue({ id: 'org-1' } as never);

    const result = await createOrganizationForUser('user-1', 'Ada Co');
    expect(result).toEqual({ organizationId: 'org-1' });
    expect(auth.api.createOrganization).toHaveBeenCalledWith({
      body: { name: 'Ada Co', slug: 'ada-co', userId: 'user-1' },
    });
  });

  it('throws instead of proceeding when every retry collides', async () => {
    dbMock.query.organization.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(createOrganizationForUser('user-1', 'Ada Co')).rejects.toThrow();
    expect(auth.api.createOrganization).not.toHaveBeenCalled();
  });
});

describe('createOrganizationShell slug uniqueness', () => {
  it('throws instead of proceeding when every retry collides', async () => {
    dbMock.query.organization.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(createOrganizationShell('Ada Co')).rejects.toThrow();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
