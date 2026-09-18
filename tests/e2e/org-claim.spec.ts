import { expect, test } from '@playwright/test';

// US1 — a sub-merchant member claims a device with its one-time code and sees
// it in their device list. Fixture from db/seed/e2e.ts (review_cepat_test only):
// e2e-org-claim / E2EORGIC1 is washed every seed, so this spec is order-independent.
test.describe('org claim by sub-merchant', () => {
  test('sub-merchant claims a device and sees it in /devices', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('sub@e2e.local');
    await page.getByLabel('Password').fill('E2e-sub-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/devices/claim');
    await page.getByLabel('Claim code').fill('E2EORGIC1');
    await page.getByRole('button', { name: 'Claim device' }).click();

    // Success navigates to the device detail page; /devices/claim never counts.
    await page.waitForURL((url) => url.pathname.startsWith('/devices/') && !url.pathname.includes('/claim'));

    await page.goto('/devices');
    await expect(page.getByText('Org Claim Counter')).toBeVisible();
  });
});