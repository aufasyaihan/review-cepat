import { createHash, randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import {
  destination,
  device,
  member,
  merchantProfile,
  organization,
  scanEvent,
  user,
} from '../schema';
import { closeDb, db } from '../seed-client';
import { ensurePermissions } from './permissions';

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
  organizationId?: string;
  memberId?: string | null;
  claimCode?: string;
  destinations?: Array<{ type: string; url: string; position: number }>;
}): Promise<string> {
  const existing = await db.query.device.findFirst({ where: eq(device.slug, seed.slug) });
  if (existing) {
    await db
      .update(device)
      .set({
        name: seed.name,
        status: seed.status,
        organizationId: seed.organizationId ?? null,
        memberId: seed.memberId ?? null,
        updatedAt: now,
      })
      .where(eq(device.id, existing.id));
    return existing.id;
  }

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
    organizationId: seed.organizationId ?? null,
    memberId: seed.memberId ?? null,
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

async function ensureOrg(id: string, name: string, slug: string): Promise<void> {
  const existing = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (existing) return;
  await db.insert(organization).values({
    id,
    name,
    slug,
    logo: null,
    metadata: null,
    createdAt: now,
  });
}

async function ensureMember(
  orgId: string,
  userId: string,
  role: 'owner' | 'member',
): Promise<void> {
  const existing = await db.query.member.findFirst({
    where: (t, { and }) => and(eq(t.organizationId, orgId), eq(t.userId, userId)),
  });
  if (existing) return;
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: orgId,
    userId,
    role,
    createdAt: now,
  });
}

async function main() {
  console.log('Seeding e2e fixtures (review_cepat_test)...');
  await ensurePermissions(db);

  const admin = await ensureUser('admin@e2e.local', 'E2e-admin-123', 'E2E Admin', 'ADMIN');
  const merchant = await ensureUser(
    'merchant@e2e.local',
    'E2e-merchant-123',
    'E2E Merchant',
    'MERCHANT',
    'E2E Shop',
  );
  const subMerchant = await ensureUser('sub@e2e.local', 'E2e-sub-123', 'E2E Sub', 'MERCHANT');

  const ORG_ID = 'e2e-org';
  await ensureOrg(ORG_ID, 'E2E Shop', 'e2e-shop');
  await ensureMember(ORG_ID, merchant.userId, 'owner');
  await ensureMember(ORG_ID, subMerchant.userId, 'member');
  const subMemberRow = await db.query.member.findFirst({
    where: (t, { and }) => and(eq(t.organizationId, ORG_ID), eq(t.userId, subMerchant.userId)),
  });

  const pub = await ensureDevice({
    slug: 'demo-tag',
    name: 'Single Link Counter',
    status: 'PUBLISHED',
    ownerId: merchant.merchantId,
    organizationId: ORG_ID,
    destinations: [{ type: 'WEBSITE', url: 'https://example.com', position: 0 }],
  });

  await ensureDevice({
    slug: 'shop-counter',
    name: 'Multi Link Counter',
    status: 'PUBLISHED',
    ownerId: merchant.merchantId,
    organizationId: ORG_ID,
    memberId: subMemberRow?.id ?? null,
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
    organizationId: ORG_ID,
    claimCode: 'E2EUNCL1',
  });

  // Dedicated device for the register-with-code e2e (kept apart from E2EUNCL1
  // so the claim-flow spec and the register-flow spec never contend). Washed
  // every run so the register spec always binds a fresh account.
  const existingRegister = await db.query.device.findFirst({
    where: eq(device.slug, 'e2e-register'),
  });
  if (existingRegister) {
    await db.delete(device).where(eq(device.id, existingRegister.id));
  }
  await ensureDevice({
    slug: 'e2e-register',
    name: 'Register Target Counter',
    status: 'UNCLAIMED',
    ownerId: null,
    organizationId: ORG_ID,
    claimCode: 'E2EREGIC1',
  });

  const existingOrgClaim = await db.query.device.findFirst({
    where: eq(device.slug, 'e2e-org-claim'),
  });
  if (existingOrgClaim) {
    await db.delete(device).where(eq(device.id, existingOrgClaim.id));
  }
  await ensureDevice({
    slug: 'e2e-org-claim',
    name: 'Org Claim Counter',
    status: 'UNCLAIMED',
    ownerId: null,
    organizationId: ORG_ID,
    claimCode: 'E2EORGIC1',
  });

  // Dedicated device for the merchant claim→configure→publish spec, so it
  // never contends with the accountless setup spec on E2EUNCL1. Washed every
  // run so the merchant flow always starts from an unclaimed device.
  const existingMerchantClaim = await db.query.device.findFirst({
    where: eq(device.slug, 'e2e-merchant-claim'),
  });
  if (existingMerchantClaim) {
    await db.delete(device).where(eq(device.id, existingMerchantClaim.id));
  }
  await ensureDevice({
    slug: 'e2e-merchant-claim',
    name: 'Merchant Claim Counter',
    status: 'UNCLAIMED',
    ownerId: null,
    organizationId: ORG_ID,
    claimCode: 'E2EMERCH1',
  });

  // Dedicated org-less device for the owner/reseller round-trip spec
  // (tests/e2e/device-option-flow.spec.ts): a signed-in owner entering its
  // code lands on /s/<slug>/option instead of the direct org bind. Washed
  // every run so the round trip always starts UNCLAIMED with a known code.
  const existingRoundTrip = await db.query.device.findFirst({
    where: eq(device.slug, 'e2e-unclaimed-2'),
  });
  if (existingRoundTrip) {
    await db.delete(device).where(eq(device.id, existingRoundTrip.id));
  }
  await ensureDevice({
    slug: 'e2e-unclaimed-2',
    name: 'Unclaimed Round Trip Counter',
    status: 'UNCLAIMED',
    ownerId: null,
    claimCode: 'E2ECLAIM',
  });

  // Dedicated device for the admin reset spec, so resetting it never destroys
  // the register-flow device (e2e-register / E2EREGIC1). Washed every run.
  const existingResetTarget = await db.query.device.findFirst({
    where: eq(device.slug, 'e2e-reset-target'),
  });
  if (existingResetTarget) {
    await db.delete(device).where(eq(device.id, existingResetTarget.id));
  }
  await ensureDevice({
    slug: 'e2e-reset-target',
    name: 'Reset Target Counter',
    status: 'UNCLAIMED',
    ownerId: null,
    organizationId: ORG_ID,
    claimCode: 'E2ERESET1',
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
  console.log(`  - merchant (owner): merchant@e2e.local / E2e-merchant-123`);
  console.log(`  - sub-merchant: sub@e2e.local / E2e-sub-123`);
  console.log(`  - claim code for /s/e2e-unclaimed: E2EUNCL1`);
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
