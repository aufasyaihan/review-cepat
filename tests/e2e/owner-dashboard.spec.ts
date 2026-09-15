import { expect, test } from '@playwright/test';

// US4 — owner dashboard: all org devices, analytics, and members management
// (db/seed/e2e.ts: merchant@e2e.local is the owner of e2e-shop).
test.describe('owner dashboard', () => {
  test('sees analytics + members in the sidebar', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await expect(page.getByRole('link', { name: 'Analytics' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Members' }).first()).toBeVisible();
  });

  test('owner can open analytics and see seeded scans', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/analytics');
    await expect(page.getByText('Total scans')).toBeVisible();
    await expect(page.getByText('Single Link Counter')).toBeVisible();
  });
});