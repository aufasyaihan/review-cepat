import { createHash, randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { destination, device, merchantProfile, scanEvent, user } from '../schema';
import { closeDb, db } from '../seed-client';

/**
 * Deterministic e2e fixtures for review_cepat_test. Idempotent — safe to run
 * on every e2e boot. Called by scripts/e2e-server.ts with the TEST DATABASE_URL.
 */
const now = new Date();

async function ensureUser(
  email: string,
  password: string,
  name: string,
  role: 'ADMIN' | 'MERCHANT',
  businessName?: string,
): Promise<{ userId: string; merchantId: number | null }> {
  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (existing) {
    const prof = await db.query.merchantProfile.findFirst({
      where: eq(merchantProfile.userId, existing.id),
    });
    return { userId: existing.id, merchantId: prof?.id ?? null };
  }

  const { user: created } = await auth.api.signUpEmail({
    body: { name, email, password, callbackURL: '/' },
  });
  await db.update(user).set({ role, emailVerified: true }).where(eq(user.id, created.id));

  let merchantId: number | null = null;
  if (businessName) {
    const inserted = await db.insert(merchantProfile).values({
      userId: created.id,
      businessName,
      phone: null,
      country: null,
      createdAt: now,
      updatedAt: now,
    });
    void inserted;
    merchantId =
      (
        await db.query.merchantProfile.findFirst({
          where: eq(merchantProfile.userId, created.id),
          columns: { id: true },
        })
      )?.id ?? null;
  }
  return { userId: created.id, merchantId };
}

async function ensureDevice(seed: {
  slug: string;
  name: string;
  status: 'UNCLAIMED' | 'PUBLISHED';
  ownerId: number | null;
  claimCode?: string;
  destinations?: Array<{ type: string; url: string; position: number }>;
}): Promise<string> {
  const existing = await db.query.device.findFirst({ where: eq(device.slug, seed.slug) });
  if (existing) return existing.id;

  const id = randomUUID();
  const claimCodeHash = seed.claimCode
    ? createHash('sha256').update(seed.claimCode).digest('hex')
    : createHash('sha256').update(`auto-${id}`).digest('hex');
  await db.insert(device).values({
    id,
    slug: seed.slug,
    name: seed.name,
    status: seed.status,
    ownerId: seed.ownerId,
    claimCodeHash,
    createdAt: now,
    updatedAt: now,
  });

  for (const d of seed.destinations ?? []) {
    await db.insert(destination).values({
      id: randomUUID(),
      deviceId: id,
      type: d.type,
      label: null,
      url: d.url,
      position: d.position,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  return id;
}

async function main() {
  console.log('Seeding e2e fixtures (review_cepat_test)...');

  const admin = await ensureUser('admin@e2e.local', 'E2e-admin-123', 'E2E Admin', 'ADMIN');
  const merchant = await ensureUser(
    'merchant@e2e.local',
    'E2e-merchant-123',
    'E2E Merchant',
    'MERCHANT',
    'E2E Shop',
  );

  const pub = await ensureDevice({
    slug: 'demo-tag',
    name: 'Single Link Counter',
    status: 'PUBLISHED',
    ownerId: merchant.merchantId,
    destinations: [{ type: 'WEBSITE', url: 'https://example.com', position: 0 }],
  });

  await ensureDevice({
    slug: 'shop-counter',
    name: 'Multi Link Counter',
    status: 'PUBLISHED',
    ownerId: merchant.merchantId,
    destinations: [
      { type: 'INSTAGRAM', url: 'https://instagram.com/e2e', position: 0 },
      { type: 'WEBSITE', url: 'https://example.com', position: 1 },
    ],
  });

  // Wash the unclaimed device every run so the claim flow always has a fresh code.
  const existingUnclaimed = await db.query.device.findFirst({
    where: eq(device.slug, 'e2e-unclaimed'),
  });
  if (existingUnclaimed) {
    await db.delete(device).where(eq(device.id, existingUnclaimed.id));
  }

  await ensureDevice({
    slug: 'e2e-unclaimed',
    name: 'Claim Me Counter',
    status: 'UNCLAIMED',
    ownerId: null,
    claimCode: 'E2ECLAIM1',
  });

  // Deterministic scan events for analytics verification.
  const existingScans = await db.query.scanEvent.findMany({ limit: 1 });
  if (existingScans.length === 0) {
    for (let i = 0; i < 5; i++) {
      await db.insert(scanEvent).values({
        id: randomUUID(),
        deviceId: pub,
        destinationId: null,
        outcome: 'LANDING_SHOWN',
        browser: 'Chrome',
        deviceType: 'mobile',
        country: 'ID',
        city: 'Jakarta',
        referrer: null,
        source: 'link',
        userAgent: 'e2e',
        ipHash: `hash-${i}`,
        createdAt: new Date(now.getTime() - i * 86_400_000),
      });
    }
  }

  console.log(`  - admin: admin@e2e.local / E2e-admin-123`);
  console.log(`  - merchant: merchant@e2e.local / E2e-merchant-123`);
  console.log(`  - claim code for /s/e2e-unclaimed: E2ECLAIM1`);
  void admin;
  console.log('E2E fixtures ready.');
}

async function run() {
  try {
    await main();
  } catch (err) {
    console.error('E2E seed failed:', err);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

void run();
