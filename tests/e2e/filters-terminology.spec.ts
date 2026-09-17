import { expect, test } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@e2e.local');
  await page.getByLabel('Password').fill('E2e-admin-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

function firstRow(page: import('@playwright/test').Page) {
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Open actions' }) })
    .first();
}

// FR-046: filtering is server-driven via toolbar inputs/combobox — there is no
// DataTable "column filter" input and no deprecated "Filter by organization"
// select on any admin surface (SC-015).
test.describe('no column / header-level organization filter (FR-046, SC-015)', () => {
  test('user-management has server search only, no column filter', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/user-management');

    await expect(page.getByLabel('Search users…')).toBeVisible();
    // No DataTable column filter input anywhere
    await expect(page.getByLabel('Filter by merchant…')).toHaveCount(0);
    await expect(page.getByLabel('Filter…')).toHaveCount(0);
    // No deprecated header-level organization filter
    await expect(page.getByLabel(/Filter by organization/i)).toHaveCount(0);
  });

  test('admin devices has no organization or column filter', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/devices');
    await expect(page.getByRole('heading', { name: 'Device inventory' })).toBeVisible();

    await expect(page.getByLabel(/Filter by organization/i)).toHaveCount(0);
    await expect(page.getByLabel(/filter/i).first()).toHaveCount(0);
  });
});

test.describe('merchants terminology (FR-047)', () => {
  test('user-management heading and "Merchant" column header use merchant terms', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/user-management');

    await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Merchant', exact: true })).toBeVisible();
    await expect(page.getByLabel(/Filter by organization/i)).toHaveCount(0);
  });

  test('merchants page heading uses "Merchants"', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/merchants');

    await expect(page.getByRole('heading', { name: 'Merchants' })).toBeVisible();
  });

  test('admin reset dialog uses "merchant" terminology', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/devices');

    await expect(page.getByRole('button', { name: 'Open actions' }).first()).toBeVisible();
    await firstRow(page).getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(/merchant/i);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('admin dashboard uses "merchants" not "organizations" in text', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard');

    await expect(page.getByText(/across all merchants/i).first()).toBeVisible();
    await expect(page.getByText(/across all merchant organizations/i)).toHaveCount(0);
    await expect(page.getByText(/across all organizations/i)).toHaveCount(0);
  });
});