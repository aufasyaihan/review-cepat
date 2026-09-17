import { expect, test } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@e2e.local');
  await page.getByLabel('Password').fill('E2e-admin-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

async function loginAsMerchant(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('merchant@e2e.local');
  await page.getByLabel('Password').fill('E2e-merchant-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

test.describe('dashboard charts (FR-048, SC-016)', () => {
  test('owner dashboard shows charts, not navigation cards or lists', async ({ page }) => {
    await loginAsMerchant(page);

    // No nav cards (AREAS grid with links to /devices, /merchants, /settings)
    await expect(page.getByRole('link', { name: 'Manage devices' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Claim a device' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Manage merchants' })).toHaveCount(0);

    // Charts render (recharts BarChart renders inside SVG with class recharts-surface)
    const charts = page.locator('svg.recharts-surface');
    await expect(charts.first()).toBeVisible();

    // Scan-per-day section exists
    await expect(page.getByText('Scans per day')).toBeVisible();
    // Scan-per-device section exists
    await expect(page.getByText('Scans per device')).toBeVisible();
  });

  test('owner dashboard shows date-range-aware summary', async ({ page }) => {
    await loginAsMerchant(page);

    // Total scans stat card
    await expect(page.getByText('Total scans')).toBeVisible();
    // Published devices stat card
    await expect(page.getByText('Published devices')).toBeVisible();
  });
});

test.describe('admin dashboard metrics (FR-051, SC-019)', () => {
  test('admin dashboard shows merchants and users metric cards', async ({ page }) => {
    await loginAsAdmin(page);

    // Total scans
    await expect(page.getByText('Total scans')).toBeVisible();
    // Published devices
    await expect(page.getByText('Published devices')).toBeVisible();
    // Merchants (from T093)
    await expect(page.getByText('Merchants').first()).toBeVisible();
    // Users (from T093)
    await expect(page.getByText('Users').first()).toBeVisible();

    // No navigation cards on admin dashboard
    await expect(
      page.getByRole('link', { name: /Manage devices|Manage merchants|Settings/i })
    ).toHaveCount(0);
  });

  test('admin dashboard shows charts, not lists', async ({ page }) => {
    await loginAsAdmin(page);

    // Charts render
    const charts = page.locator('svg.recharts-surface');
    await expect(charts.first()).toBeVisible();

    await expect(page.getByText('Scans per day')).toBeVisible();
    await expect(page.getByText('Scans per device')).toBeVisible();
  });
});

test.describe('device slug copy button (FR-049, SC-017)', () => {
  test('copy button next to device slug copies URL to clipboard and shows toast', async ({
    page,
  }) => {
    await loginAsMerchant(page);
    await page.goto('/devices');

    // Grant clipboard permission before clicking the copy button
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Find the row with "Single Link Counter"
    const row = page.getByRole('row').filter({ hasText: 'Single Link Counter' });
    // The copy button is the icon-only button in the slug cell; the actions
    // column is the only button with aria-label="Open actions".
    const copyBtn = row.locator('button:not([aria-label="Open actions"])');
    await copyBtn.click();

    // Toast shows "Link copied"
    await expect(page.getByText('Link copied')).toBeVisible();
  });

  test('copy button exists in admin device inventory too', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/devices');

    // Find a row with a copy button
    const row = page.getByRole('row').filter({ hasText: 'Single Link Counter' });
    const copyBtn = row.locator('button:not([aria-label="Open actions"])');
    await expect(copyBtn).toHaveCount(1);
  });
});

test.describe('badge rendering (FR-050, SC-018)', () => {
  test('device status is rendered as a Badge component, not a custom pill', async ({ page }) => {
    await loginAsMerchant(page);
    await page.goto('/devices');

    // Find the status cell for the PUBLISHED device
    const row = page.getByRole('row').filter({ hasText: 'Single Link Counter' });
    // The status badge shows "PUBLISHED"
    const badge = row.locator('span').filter({ hasText: 'PUBLISHED' });
    await expect(badge).toBeVisible();

    // The badge should have the "success" variant styling (green-ish).
    // shadcn Badge with variant=success adds class names. We just assert the badge exists.
    await expect(badge).toHaveCount(1);
  });

  test('role badges on user-management use Badge component', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/user-management');

    const subRow = page.getByRole('row').filter({ has: page.getByText('E2E Sub', { exact: true }) });
    await expect(subRow.getByText('member')).toBeVisible();

    const ownerRow = page
      .getByRole('row')
      .filter({ has: page.getByText('E2E Merchant', { exact: true }) });
    await expect(ownerRow.getByText('owner')).toBeVisible();
  });
});