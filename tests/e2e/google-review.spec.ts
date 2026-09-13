import { expect, test } from '@playwright/test';

// US5 — Google review destination: place search UI renders and stays stable
// even when GOOGLE_PLACES_API_KEY is unset (server returns empty results).
test.describe('google review destination', () => {
  test('renders the place search flow on a device', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/devices');
    await page.getByRole('link', { name: 'Multi Link Counter' }).click();
    await page.waitForURL('**/devices/**');

    await page.getByRole('button', { name: '+ Add destination' }).click();
    await page.locator('select').nth(1).selectOption('GOOGLE_REVIEW');
    await page.getByPlaceholder('Search a business on Google…').fill('cafe jakarta');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });
});