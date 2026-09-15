import { expect, test } from '@playwright/test';

// US2 — a new user registers with a claim code (FR-024): account created, joined
// the device's organization as member, device bound. See db/seed/e2e.ts.
test.describe('register with claim code', () => {
  test('signs up, links the device, and lands on the device list', async ({ page }) => {
    const email = `sub-${Date.now()}@e2e.local`;
    await page.goto('/register-claim');
    await page.getByLabel('Your name').fill('E2E Subscriber');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('E2e-new-123');
    await page.getByLabel('Claim code').fill('E2EREGIC1');
    await page.getByRole('button', { name: 'Register & link device' }).click();

    await page.waitForURL('**/devices');
    await expect(page.getByRole('heading', { name: /devices/i }).first()).toBeVisible();
  });
});