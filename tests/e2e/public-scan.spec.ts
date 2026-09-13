import { expect, test } from '@playwright/test';

/**
 * US2 — public scan resolution (contract public-scan.md).
 * Requires a seeded MySQL database (see quickstart.md Scenario 4–6).
 */
test.describe('public scan resolution', () => {
  test('single-link device redirects without an intermediate page', async ({ page }) => {
    await page.goto('/s/demo-tag', { waitUntil: 'commit' });
    // Replaced by the server-side redirect; the shared destination page appears.
    await expect(page).toHaveURL(/https:\/\/example\.com/);
  });

  test('unknown slug renders a 404', async ({ page }) => {
    const response = await page.goto('/s/does-not-exist-123');
    expect(response?.status()).toBe(404);
  });
});