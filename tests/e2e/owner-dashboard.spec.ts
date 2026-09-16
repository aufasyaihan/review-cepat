import { expect, test } from '@playwright/test';

// US4 — owner dashboard: all org devices, analytics, and members management
// (db/seed/e2e.ts: merchant@e2e.local is the owner of e2e-shop).
test.describe('owner dashboard', () => {
  test('sees user-management in the sidebar', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await expect(page.getByRole('link', { name: 'User management' }).first()).toBeVisible();
  });

  test('owner sees analytics and seeded scans on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('merchant@e2e.local');
    await page.getByLabel('Password').fill('E2e-merchant-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    // Analytics live on /dashboard (no standalone route).
    await expect(page.getByText('Total scans')).toBeVisible();
    await expect(page.getByText('Single Link Counter')).toBeVisible();
  });
});

// US: admin cross-org user management (db/seed/e2e.ts: admin@e2e.local is
// ADMIN; E2E Shop is owned by merchant@e2e.local with member sub@e2e.local).
test.describe('admin user management', () => {
  test('admin reaches /user-management without being redirected and sees members from every org', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.local');
    await page.getByLabel('Password').fill('E2e-admin-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.getByRole('link', { name: 'User management' }).first().click();
    await expect(page).toHaveURL(/\/user-management$/);
    await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
    await expect(page.getByText('E2E Merchant')).toBeVisible();
    await expect(page.getByText('E2E Sub', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Shop').first()).toBeVisible();
  });

  test('admin can filter members by organization', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.local');
    await page.getByLabel('Password').fill('E2e-admin-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');
    await page.goto('/user-management');

    await page.getByLabel('Filter by organization').click();
    await page.getByRole('option', { name: 'E2E Shop' }).click();
    await expect(page.getByText('E2E Sub', { exact: true })).toBeVisible();
  });
});