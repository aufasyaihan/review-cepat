import { expect, test } from '@playwright/test';

// US6 — marketing homepage is SEO-ready (FR-018, FR-019).
test.describe('marketing homepage', () => {
  test('renders branding content and links to register', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /turn every tap and scan/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get started' }).first()).toBeVisible();
  });

  test('exposes robots.txt and sitemap.xml', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('sitemap');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain('xmlns');
  });
});