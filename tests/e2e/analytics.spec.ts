import { expect, test } from '@playwright/test';

// US4 — merchant analytics reflect seeded scan events (db/seed/e2e.ts: 5 scans).
test.describe('merchant analytics', () => {
  test('shows total scans and per-device rows on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await expect(page.getByText('Total scans')).toBeVisible();
    await expect(page.getByText('Single Link Counter')).toBeVisible();
    // Total card value is a number >= 0 (exact count varies as the public scan
    // test records scans during the run, so assert shape, not an exact value).
    const totalCard = page.getByText('Total scans').locator('..').locator('..');
    await expect(totalCard.getByText(/^\d+$/)).toBeVisible();
  });
});

// FR-044 — admin dashboard shows cross-merchant analytics filterable by a
// date-range picker (db/seed/e2e.ts: admin@e2e.local is ADMIN).
test.describe('admin dashboard analytics', () => {
  test('shows platform-wide analytics and applies a preset date range', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.local');
    await page.getByLabel('Password').fill('E2e-admin-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await expect(page.getByText('Total scans')).toBeVisible();
    await expect(page.getByText('Published devices')).toBeVisible();
    // Cross-merchant: the owner's seeded device appears in the admin breakdown.
    await expect(page.getByText('Single Link Counter')).toBeVisible();

    const trigger = page.getByRole('button', { name: /Pick a date range/ });
    await trigger.click();
    await page.getByRole('button', { name: 'Last 7 days' }).click();
    await page.getByRole('button', { name: 'Apply' }).click();

    // The trigger now shows the applied range instead of the placeholder.
    await expect(page.getByRole('button', { name: /Pick a date range/ })).toHaveCount(0);
    await expect(page.getByText(/–/).first()).toBeVisible();
    await expect(page.getByText('Total scans')).toBeVisible();
  });

  test('rejects an invalid date range at the API boundary', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.local');
    await page.getByLabel('Password').fill('E2e-admin-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    const res = await page.request.get(
      '/api/analytics/admin-overview?from=2025-08-01&to=2025-06-30',
    );
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('VALIDATION');
  });
});