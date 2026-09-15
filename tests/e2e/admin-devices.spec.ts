import { expect, test } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@e2e.local');
  await page.getByLabel('Password').fill('E2e-admin-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/admin');
}

// US3 — admin creates a device and sees the one-time claim code.
test.describe('admin device management', () => {
  test('creates a device and shows the one-time claim code', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/devices/new');
    await page.getByLabel('Device name').fill('POS Counter');
    await page.getByRole('button', { name: 'Create device' }).click();

    await expect(page.getByTestId('new-device-result')).toBeVisible();
    await expect(page.getByText('Device created').first()).toBeVisible();
    await expect(page.getByText(/one-time claim code/i)).toBeVisible();
  });

  test('admin reset clears the organization binding (FR-028)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/devices');
    await expect(page.getByRole('heading', { name: 'Device inventory' })).toBeVisible();

    // Reset the register-target device and confirm via toast.
    await page.getByRole('row', { name: /Register Target Counter/ }).getByRole('button', {
      name: 'Reset',
    }).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText(/organization cleared/i)).toBeVisible();
  });
});