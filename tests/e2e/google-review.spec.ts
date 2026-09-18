import { expect, test } from '@playwright/test';

// US5 — Google review destination: place search UI renders and stays stable
// even when GOOGLE_PLACES_API_KEY is unset (server returns empty results).
// The destination editor now lives on the accountless setup-redirect flow
// (/s/[slug]/setup → claim code → Configure page), not a dashboard device page.
test.describe('google review destination', () => {
  test('renders the place search flow during device setup', async ({ page }) => {
    await page.goto('/s/e2e-unclaimed/setup');
    await page.getByLabel('Claim code').fill('E2EUNCL1');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Configure Claim Me Counter' })).toBeVisible();

    await page.getByPlaceholder('Search a business on Google…').fill('cafe jakarta');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });
});