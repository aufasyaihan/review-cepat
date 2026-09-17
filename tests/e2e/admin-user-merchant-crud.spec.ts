import { expect, test } from '@playwright/test';

const ts = Date.now();

test.describe.configure({ mode: 'serial' });

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@e2e.local');
  await page.getByLabel('Password').fill('E2e-admin-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

// SC-020 / FR-052-053: admin user CRUD happens through in-place dialogs; deletes
// go through a destructive AlertDialog.
test.describe('admin user CRUD (T096, SC-020)', () => {
  test('Add user shows in list; Edit renames/re-roles; Delete requires AlertDialog confirm', async ({
    page,
  }) => {
    const email = `crud-user-${ts}@example.com`;
    const name = `Crud User ${ts}`;
    const renamed = `Crud Renamed ${ts}`;

    await loginAsAdmin(page);
    await page.goto('/user-management');
    await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add user' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open actions' }).first()).toBeVisible();

    // -- Add user -----------------------------------------------------------
    await page.getByRole('button', { name: 'Add user' }).click();
    const addDialog = page.getByRole('dialog');
    await expect(addDialog.getByRole('heading', { name: 'Add user' })).toBeVisible();

    await addDialog.getByLabel('Name').fill(name);
    await addDialog.getByLabel('Email').fill(email);
    await addDialog.getByLabel('Password').fill('E2e-user-123');

    await addDialog.getByRole('button', { name: 'Select merchant…' }).click();
    await page.getByPlaceholder('Search merchants…').fill('E2E Shop');
    await expect(page.getByRole('button', { name: 'E2E Shop' })).toBeVisible();
    await page.getByRole('button', { name: 'E2E Shop' }).last().click();

    await addDialog.getByLabel('Role').click();
    await page.getByRole('option', { name: 'Member' }).click();

    await addDialog.getByRole('button', { name: 'Add user' }).click();
    await expect(addDialog).toHaveCount(0);

    // Searching re-fetches server-side with `q`; the debounced query lands after
    // the create committed, so the row is guaranteed to be present and proves
    // the member is searchable, not just persisted.
    const searchReq = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return req.method() === 'GET' && url.pathname === '/api/members' && url.searchParams.get('q') === email;
    });
    await page.getByLabel('Search users…').fill(email);
    await searchReq;

    const newRow = page.getByRole('row').filter({ hasText: email });
    await expect(newRow).toBeVisible();

    // -- Edit: rename + re-role --------------------------------------------
    await newRow.getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByRole('heading', { name: 'Edit user' })).toBeVisible();

    await editDialog.getByLabel('Name').fill(renamed);
    await editDialog.getByLabel('Role').click();
    await page.getByRole('option', { name: 'Owner' }).click();
    await editDialog.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).toHaveCount(0);

    const renamedRow = page.getByRole('row').filter({ hasText: renamed });
    await expect(renamedRow).toBeVisible();

    // -- Delete: destructive AlertDialog confirms ---------------------------
    await renamedRow.getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const alert = page.getByRole('alertdialog');
    await expect(alert.getByRole('heading', { name: `Delete ${renamed}?` })).toBeVisible();
    await expect(alert).toContainText('deactivates their account');
    await alert.getByRole('button', { name: 'Delete' }).click();
    await expect(renamedRow).toHaveCount(0);
  });
});

// SC-021 / FR-054: merchant CRUD. Add creates only the org shell (no owner);
// Edit assigns an owner; Delete requires AlertDialog confirm (SC-024).
test.describe('admin merchant CRUD (T096, SC-021)', () => {
  test('Add merchant creates a shell; Edit assigns owner; Delete requires AlertDialog confirm', async ({
    page,
  }) => {
    const merchantName = `Mega Mart ${ts}`;

    await loginAsAdmin(page);
    await page.goto('/merchants');
    await expect(page.getByRole('heading', { name: 'Merchants' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'E2E Shop' })).toBeVisible();

    // -- Add merchant: shell only, no owner assigned ------------------------
    await page.getByRole('button', { name: 'Add merchant' }).click();
    const addDialog = page.getByRole('dialog');
    await expect(addDialog.getByRole('heading', { name: 'Add merchant' })).toBeVisible();
    await expect(addDialog).toContainText('owner is assigned later');

    await addDialog.getByLabel('Business name').fill(merchantName);
    await addDialog.getByRole('button', { name: 'Add merchant' }).click();
    await expect(addDialog).toHaveCount(0);

    // Re-fetch via the debounced search so the shell is confirmed server-side.
    const searchReq = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return req.method() === 'GET' && url.pathname === '/api/organizations' && url.searchParams.get('q') === merchantName;
    });
    await page.getByLabel('Search merchants…').fill(merchantName);
    await searchReq;

    const row = page.getByRole('row').filter({ hasText: merchantName });
    await expect(row).toBeVisible();

    // -- Edit: rename + assign owner from existing accounts ------------------
    await row.getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByRole('heading', { name: `Edit ${merchantName}` })).toBeVisible();

    await editDialog.getByLabel('Owner').click();
    await page.getByRole('option', { name: /E2E Sub/ }).click();
    await editDialog.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).toHaveCount(0);

    // -- Delete: destructive AlertDialog confirms -----------------------------
    await row.getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const alert = page.getByRole('alertdialog');
    await expect(alert.getByRole('heading', { name: `Delete ${merchantName}?` })).toBeVisible();
    await expect(alert).toContainText('Devices assigned');
    await alert.getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
  });
});