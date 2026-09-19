// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OptionClient } from '@/app/(redirect)/s/[slug]/option/option-client';
import { claimForSelfAction, resellDeviceAction } from '@/domains/device/server/option-actions';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
}));
vi.mock('@/domains/device/server/option-actions', () => ({
  claimForSelfAction: vi.fn(),
  resellDeviceAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockPush = vi.fn();
vi.mocked(useRouter).mockReturnValue({ replace: vi.fn(), push: mockPush } as never);

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OptionClient deviceId="dev-1" token="tok-abc" />
    </QueryClientProvider>,
  );
}

describe('OptionClient', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it('renders both choices', () => {
    renderClient();
    expect(screen.getByRole('button', { name: /claim for yourself/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resell/i })).toBeInTheDocument();
  });

  it('confirms then claims for self', async () => {
    vi.mocked(claimForSelfAction).mockResolvedValue({
      ok: true,
      data: { redirectUrl: '/dashboard' },
    });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: /claim for yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    await waitFor(() => {
      expect(claimForSelfAction).toHaveBeenCalledWith('dev-1', 'tok-abc');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('confirms then resells and shows the new claim code', async () => {
    vi.mocked(resellDeviceAction).mockResolvedValue({ ok: true, data: { claimCode: 'NEWCODE1' } });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: /^resell$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    await waitFor(() => {
      expect(resellDeviceAction).toHaveBeenCalledWith('dev-1', 'tok-abc');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});
