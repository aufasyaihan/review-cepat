import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG AA audit (SC-007 / T045): scans core public + authenticated surfaces for
// serious+ violations with axe-core. Contrast, keyboard/focus and names are
// checked by the default WCAG AA ruleset.
async function expectA11yClean(page: import('@playwright/test').Page) {
  await page.waitForTimeout(600); // let framer-motion entrances settle
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const violations = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
  expect(
    violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
  ).toEqual([]);
}

test.describe('WCAG AA audit', () => {
  test('homepage is a11y clean', async ({ page }) => {
    await page.goto('/');
    await expectA11yClean(page);
  });

  test('public multi-link scan page is a11y clean', async ({ page }) => {
    await page.goto('/s/shop-counter');
    await expectA11yClean(page);
  });

  test('accountless setup claim-code page is a11y clean', async ({ page }) => {
    await page.goto('/s/e2e-unclaimed/setup');
    await expectA11yClean(page);
  });

  test('login page is a11y clean', async ({ page }) => {
    await page.goto('/login');
    await expectA11yClean(page);
  });

  test('merchant dashboard is a11y clean', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');
    await expectA11yClean(page);
  });
});