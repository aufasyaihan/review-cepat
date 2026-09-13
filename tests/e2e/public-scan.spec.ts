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

  test('unknown slug renders the not-found page', async ({ page }) => {
    await page.goto('/s/does-not-exist-123');
    // Next.js streams a 200 shell before the async notFound sets the real status;
    // assert the UI heading instead to stay robust.
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});