import { expect, test } from '@playwright/test';

// US4 — merchant analytics reflect seeded scan events (db/seed/e2e.ts: 5 scans).
test.describe('merchant analytics', () => {
  test('shows total scans and per-device rows', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/analytics');
    await expect(page.getByText('Total scans')).toBeVisible();
    await expect(page.getByText('Single Link Counter')).toBeVisible();
    // Total card value is a number >= 0 (exact count varies as the public scan
    // test records scans during the run, so assert shape, not an exact value).
    await expect(page.locator('p.text-3xl')).toContainText(/^\d+$/);
  });
});