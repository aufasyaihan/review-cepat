// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesClient } from '@/app/(dashboard)/devices/devices-client';
import { deviceQueries } from '@/domains/device/api/queries';
import { forgetDeviceAction } from '@/domains/device/server/actions';

vi.mock('@/domains/device/server/actions', () => ({
  publishDeviceAction: vi.fn(),
  unpublishDeviceAction: vi.fn(),
  resetDeviceAction: vi.fn(),
  forgetDeviceAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DEVICE = {
  id: 'dev-1',
  slug: 'dev-1-slug',
  name: 'Device One',
  status: 'CLAIMED' as const,
  createdAt: new Date().toISOString(),
};

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(deviceQueries.list().queryKey, [DEVICE]);
  return render(
    <QueryClientProvider client={client}>
      <DevicesClient isOwner />
    </QueryClientProvider>,
  );
}

describe('DevicesClient row actions', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it('forgets a device after confirmation', async () => {
    vi.mocked(forgetDeviceAction).mockResolvedValue({
      ok: true,
      data: { device: { ...DEVICE, status: 'UNCLAIMED' }, claimCode: 'NEWCODE1' },
    });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: /open actions/i }));
    fireEvent.click(screen.getByText('Forgot device'));
    fireEvent.click(screen.getByRole('button', { name: /forget device/i }));
    await waitFor(() => expect(forgetDeviceAction).toHaveBeenCalledWith('dev-1'));
  });
});
