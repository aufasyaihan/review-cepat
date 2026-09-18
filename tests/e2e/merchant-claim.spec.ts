import { expect, test } from '@playwright/test';

// US1 — merchant claims a device, configures a destination, publishes it.
// Fixtures come from db/seed/e2e.ts (review_cepat_test only). Uses the
// dedicated e2e-merchant-claim device so it never contends with setup-claim.
test.describe('merchant claim → configure → publish', () => {
  test('claims /s/e2e-merchant-claim with its one-time code and publishes it', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/devices/claim');
    await page.getByLabel('Claim code').fill('E2EMERCH1');
    await page.getByRole('button', { name: 'Claim device' }).click();
    await page.waitForURL('**/devices/**');

    await page.getByRole('button', { name: '+ Add destination' }).click();
    await page.locator('input[placeholder="https://…"]').fill('https://example.com');
    await page.getByRole('button', { name: 'Save destinations' }).click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Device published.')).toBeVisible();
  });

  test('rejects an invalid claim code with a clear error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/devices/claim');
    await page.getByLabel('Claim code').fill('ZZZZZZZZ');
    await page.getByRole('button', { name: 'Claim device' }).click();
    await expect(page.getByText(/claim code not found/i)).toBeVisible();
  });
});