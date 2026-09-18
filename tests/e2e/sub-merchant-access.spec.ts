import { expect, test } from '@playwright/test';

// US5 — sub-merchant isolation (SC-008): sub@e2e.local is a member of e2e-shop,
// sees only their assigned device (shop-counter) and no analytics/members nav.
test.describe('sub-merchant isolation', () => {
  test('sees only assigned devices in the sidebar and list', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('sub@e2e.local');
    await page.getByLabel('Password').fill('E2e-sub-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    // No user-management nav for members (owner-only).
    await expect(page.getByRole('link', { name: 'User management' })).toHaveCount(0);
    // No analytics section on the member dashboard.
    await expect(page.getByText('Total scans')).toHaveCount(0);

    await page.goto('/devices');
    // Only the assigned device is visible.
    await expect(page.getByText('Multi Link Counter')).toBeVisible();
    await expect(page.getByText('Single Link Counter')).toHaveCount(0);
  });
});