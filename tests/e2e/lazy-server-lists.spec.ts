import { expect, test } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@e2e.local');
  await page.getByLabel('Password').fill('E2e-admin-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

function membersRequest(q: string) {
  return (req: import('@playwright/test').Request) => {
    const url = new URL(req.url());
    return (
      req.method() === 'GET' &&
      url.pathname === '/api/members' &&
      url.searchParams.get('q') === q
    );
  };
}

function organizationsRequest(q: string) {
  return (req: import('@playwright/test').Request) => {
    const url = new URL(req.url());
    return (
      req.method() === 'GET' &&
      url.pathname === '/api/organizations' &&
      url.searchParams.get('q') === q
    );
  };
}

// FR-055: the admin tables re-fetch server-side. Debounced search shows up as
// `q` in the network request — never client-side filtering of a loaded list.
test.describe('server-driven member list (FR-055, SC-015)', () => {
  test('user-management search re-fetches /api/members with a debounced q', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/user-management');
    await expect(page.getByLabel('Search users…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open actions' }).first()).toBeVisible();

    const searchReq = page.waitForRequest(membersRequest('zzz-no-such-user'));
    await page.getByLabel('Search users…').fill('zzz-no-such-user');
    await searchReq;

    // The server returned zero rows; the table renders the empty state.
    await expect(page.getByText('No results.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open actions' })).toHaveCount(0);
  });

  test('merchants search re-fetches /api/organizations with a debounced q', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/merchants');
    await expect(page.getByLabel('Search merchants…')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'E2E Shop' })).toBeVisible();

    const searchReq = page.waitForRequest(organizationsRequest('zzz-no-such-merchant'));
    await page.getByLabel('Search merchants…').fill('zzz-no-such-merchant');
    await searchReq;

    await expect(page.getByText('No results.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'E2E Shop' })).toHaveCount(0);
  });

  test('rows-per-page change re-fetches /api/organizations with a new limit', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/merchants');
    await expect(page.getByRole('row').filter({ hasText: 'E2E Shop' })).toBeVisible();

    const limitReq = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return req.method() === 'GET' && url.pathname === '/api/organizations' && url.searchParams.get('limit') === '20';
    });
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: '20' }).click();
    await limitReq;
  });
});

// FR-056: the merchant combobox streams options via TanStack infinite query.
// Empty/exhausted states render instead of erroring.
test.describe('merchant combobox (FR-056)', () => {
  test('combobox options re-fetch server-side and render an empty state', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/user-management');
    await expect(page.getByRole('button', { name: 'Open actions' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'All merchants…' }).click();
    await expect(page.getByRole('button', { name: 'E2E Shop' })).toBeVisible();

    const searchReq = page.waitForRequest(organizationsRequest('qqq'));
    await page.getByPlaceholder('Search merchants…').fill('qqq');
    await searchReq;

    await expect(page.getByText('No merchants found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'E2E Shop' })).toHaveCount(0);
  });
});