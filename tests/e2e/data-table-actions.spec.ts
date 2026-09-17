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

// FR-045 / SC-014 — device, user-management, and merchant tables render a
// frozen right-side Actions column. Each row's EllipsisVertical button opens a
// DropdownMenu (actions-column.tsx); actions launch the matching dialog.
test.describe('data-table actions column (FR-045, SC-014)', () => {
  test('admin device inventory actions: Edit opens the rename dialog', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/devices');

    await expect(page.getByRole('heading', { name: 'Device inventory' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open actions' }).first()).toBeVisible();

    const row = firstRow(page);
    const deviceName = (await row.locator('td').first().innerText()).trim();
    await row.getByRole('button', { name: 'Open actions' }).click();

    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Disable|Re-enable/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: `Edit ${deviceName}` })).toBeVisible();
    // Stays in place — no navigation to the device detail page
    await expect(page).not.toHaveURL(/\/devices\/[^/]+$/);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('admin user management actions: Edit opens the dialog, Delete opens AlertDialog', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/user-management');

    await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open actions' }).first()).toBeVisible();

    const row = firstRow(page);
    const userName = (await row.locator('td').first().innerText()).trim();
    await row.getByRole('button', { name: 'Open actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

    // Edit is an in-place dialog for admins (no navigation to the detail page)
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit user' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/user-management\/[^/]+$/);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    // Delete is a destructive AlertDialog
    await row.getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const alert = page.getByRole('alertdialog');
    await expect(alert.getByRole('heading', { name: `Delete ${userName}?` })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Delete' })).toBeVisible();
    await alert.getByRole('button', { name: 'Cancel' }).click();
    await expect(alert).toHaveCount(0);
  });

  test('admin merchants actions: Edit and Delete open their dialogs', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/merchants');

    await expect(page.getByRole('heading', { name: 'Merchants' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open actions' }).first()).toBeVisible();

    const shopRow = page.getByRole('row').filter({ hasText: 'E2E Shop' });
    await shopRow.getByRole('button', { name: 'Open actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit E2E Shop' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    await shopRow.getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const alert = page.getByRole('alertdialog');
    await expect(alert.getByRole('heading', { name: 'Delete E2E Shop?' })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Delete' })).toBeVisible();
    await alert.getByRole('button', { name: 'Cancel' }).click();
    await expect(alert).toHaveCount(0);
  });
});