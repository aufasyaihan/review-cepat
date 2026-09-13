import { expect, test } from '@playwright/test';

// US3 — admin creates a device and sees the one-time claim code.
test.describe('admin device management', () => {
  test('creates a device and shows the one-time claim code', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.local');
    await page.getByLabel('Password').fill('E2e-admin-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/admin');

    await page.goto('/admin/devices/new');
    await page.getByLabel('Device name').fill('POS Counter');
    await page.getByRole('button', { name: 'Create device' }).click();

    await expect(page.getByTestId('new-device-result')).toBeVisible();
    await expect(page.getByText('Device created')).toBeVisible();
    await expect(page.getByText(/one-time claim code/i)).toBeVisible();
  });
});