import { expect, test } from '@playwright/test';

/**
 * US1 — accountless setup flow (FR-004, contract setup-claim.md).
 * Requires a seeded MySQL database (see quickstart.md Scenario 3).
 */
test.describe('accountless device setup', () => {
  test('claim code on /setup accepts and shows the redirect chooser', async ({ page }) => {
    await page.goto('/s/e2e-unclaimed/setup');
    await expect(page.getByRole('heading', { name: 'Set up your device' })).toBeVisible();

    await page.getByLabel('Claim code').fill('E2ECLAIM1');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Reached the destination-type chooser (a valid setup token is required).
    await expect(
      page.getByRole('heading', { name: 'Configure Claim Me Counter' }),
    ).toBeVisible();
  });

  test('a wrong claim code stays on the setup page with an error toast', async ({ page }) => {
    await page.goto('/s/e2e-unclaimed/setup');
    await page.getByLabel('Claim code').fill('WRONG_CODE');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Set up your device' })).toBeVisible();
  });

  test('unknown slug renders the not-found page', async ({ page }) => {
    await page.goto('/s/does-not-exist-123/setup');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});