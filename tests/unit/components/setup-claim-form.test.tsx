// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SetupClaimForm } from '@/app/(redirect)/[slug]/setup/setup-claim-form';
import { setupClaimCodeAction } from '@/domains/device/server/setup-actions';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
}));

vi.mock('@/domains/device/server/setup-actions', () => ({
  setupClaimCodeAction: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockReplace = vi.fn();
vi.mocked(useRouter).mockReturnValue({ replace: mockReplace, push: vi.fn() } as never);

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SetupClaimForm slug="slug-one" />
    </QueryClientProvider>,
  );
}

describe('SetupClaimForm (US1 claim-code entry)', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the claim-code input and continue button', () => {
    renderForm();
    expect(screen.getByLabelText('Claim code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('is disabled until a claim code is typed', () => {
    renderForm();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('submits the claim code and navigates to the redirect step on success', async () => {
    vi.mocked(setupClaimCodeAction).mockResolvedValue({
      ok: true,
      data: { redirectUrl: '/slug-one/setup/redirect?t=tok' },
    });

    renderForm();
    fireEvent.change(screen.getByLabelText('Claim code'), { target: { value: 'ABCD1234' } });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(setupClaimCodeAction).toHaveBeenCalledWith('slug-one', { claimCode: 'ABCD1234' });
      expect(mockReplace).toHaveBeenCalledWith('/slug-one/setup/redirect?t=tok');
    });
  });
});
