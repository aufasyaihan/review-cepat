import { expect, test } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@e2e.local');
  await page.getByLabel('Password').fill('E2e-admin-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

// US3/US6 — admin creates a device (via the /devices inventory dialog) and sees
// the one-time claim code; admin reset clears the organization binding.
test.describe('admin device management', () => {
  test('creates a device and shows the one-time claim code', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/devices');
    await page.getByRole('button', { name: 'New device' }).click();
    await page.getByLabel('Device name').fill('POS Counter');
    await page.getByRole('button', { name: 'Create device' }).click();

    await expect(page.getByTestId('new-device-result')).toBeVisible();
    await expect(page.getByText('Device created').first()).toBeVisible();
    await expect(page.getByText(/one-time claim code/i)).toBeVisible();
  });

  test('admin reset clears the organization binding (FR-028)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/devices');

    // Reset the reset-target device and confirm via toast. Uses the dedicated
    // e2e-reset-target device so resetting never breaks the register flow
    // (e2e-register / E2EREGIC1). Reset now lives in the row actions dropdown
    // (FR-045).
    const resetRow = page.getByRole('row', { name: /Reset Target Counter/ });
    await resetRow.getByRole('button', { name: 'Open actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText(/merchant cleared/i)).toBeVisible();
  });

  test('signed-in user is bounced back to /dashboard from /login', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/login');
    await page.waitForURL('**/dashboard');
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });
});