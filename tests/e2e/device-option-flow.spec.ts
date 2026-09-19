import { expect, test } from '@playwright/test';

/**
 * Owner/reseller post-claim branch (spec: docs/superpowers/specs/
 * 2026-09-18-device-claim-reseller-flow-design.md). Requires the seeded
 * org-less device /s/e2e-unclaimed-2 (code E2ECLAIM) and the e2e org owner
 * merchant@e2e.local (db/seed/e2e.ts).
 *
 * /option requires proof the claim code was validated (a short-lived token
 * minted only by setupClaimCodeAction) — it can no longer be hit cold, so
 * both tests obtain the token by going through /setup with the code.
 *
 * Both tests share the same device + claim code, and test 2 rotates the code
 * (resell). Config is fullyParallel, so re-ordering would let test 2's
 * rotation race ahead of test 1's code entry — serialize them instead.
 */
test.describe('device option flow (org owner, org-less device)', () => {
  test.describe.configure({ mode: 'serial' });

  async function loginAsOwner(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');
  }

  async function enterClaimCode(page: import('@playwright/test').Page, code: string) {
    await page.goto('/s/e2e-unclaimed-2/setup');
    await page.getByLabel('Claim code').fill(code);
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  test('entering the claim code as a signed-in owner skips straight to /option with a proof token', async ({
    page,
  }) => {
    await loginAsOwner(page);

    await enterClaimCode(page, 'E2ECLAIM');

    await expect(page).toHaveURL(/\/s\/e2e-unclaimed-2\/option\?t=.+/);
    await expect(page.getByRole('button', { name: 'Claim for yourself' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resell' })).toBeVisible();
  });

  test('resell resets the device back to unclaimed with a new code', async ({ page }) => {
    await loginAsOwner(page);

    await enterClaimCode(page, 'E2ECLAIM');
    await page.getByRole('button', { name: 'Resell' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    // The OLD code is rotated by the resell, so re-entering it on /setup
    // stays on the setup page with an error state.
    await enterClaimCode(page, 'E2ECLAIM');
    await expect(page.getByRole('heading', { name: 'Set up your device' })).toBeVisible();
  });
});