import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/domains/device/server/service', () => ({
  getById: vi.fn(),
}));
vi.mock('@/domains/destination/server/service', () => ({
  setForDeviceSetup: vi.fn(),
}));
vi.mock('@/lib/setup-token', () => ({
  verifySetupToken: vi.fn(),
}));

import { setForDeviceSetup } from '@/domains/destination/server/service';
import { saveSetupDestinationsAction } from '@/domains/destination/server/setup-actions';
import { getById } from '@/domains/device/server/service';
import { verifySetupToken } from '@/lib/setup-token';

const validInput = {
  destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifySetupToken).mockReturnValue(true);
});

describe('saveSetupDestinationsAction (US1 step 2)', () => {
  it('rejects a missing/invalid setup token', async () => {
    vi.mocked(verifySetupToken).mockReturnValue(false);
    const result = await saveSetupDestinationsAction('dev-1', 'bad-token', validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('expired or invalid');
    expect(setForDeviceSetup).not.toHaveBeenCalled();
  });

  it('rejects invalid destination payloads', async () => {
    const result = await saveSetupDestinationsAction('dev-1', 'tok', { destinations: [] });
    expect(result.ok).toBe(false);
  });

  it('saves destinations and returns the public slug', async () => {
    vi.mocked(setForDeviceSetup).mockResolvedValue([] as never);
    vi.mocked(getById).mockResolvedValue({ slug: 'slug-one' } as never);
    const result = await saveSetupDestinationsAction('dev-1', 'tok', validInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.slug).toBe('slug-one');
    expect(setForDeviceSetup).toHaveBeenCalledWith('dev-1', validInput);
  });

  it('maps save failures to a friendly error', async () => {
    vi.mocked(setForDeviceSetup).mockRejectedValue(new Error('Device not found'));
    const result = await saveSetupDestinationsAction('dev-1', 'tok', validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Device not found');
  });

  it('maps non-Error throwables to a generic message', async () => {
    vi.mocked(setForDeviceSetup).mockRejectedValue('boom');
    const result = await saveSetupDestinationsAction('dev-1', 'tok', validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Failed to save destinations');
  });

  it('fails when the device record cannot be reloaded after saving', async () => {
    vi.mocked(setForDeviceSetup).mockResolvedValue([] as never);
    vi.mocked(getById).mockResolvedValue(null);
    const result = await saveSetupDestinationsAction('dev-1', 'tok', validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Device not found');
  });
});
