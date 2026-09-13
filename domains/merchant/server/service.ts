import { count, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { device, merchantProfile, user } from '@/db/schema';
import { type ProfileOutput, profileSchema } from '@/domains/merchant/schemas/profile';
import { AppError } from '@/lib/errors';

function toDto(row: {
  id: number;
  userId: string;
  businessName: string;
  phone: string | null;
  country: string | null;
}): ProfileOutput {
  return row;
}

export async function upsertProfile(userId: string, input: unknown): Promise<ProfileOutput> {
  const { businessName, phone, country } = profileSchema.parse(input);
  const db = getDb();
  const now = new Date();

  const existing = await db.query.merchantProfile.findFirst({
    where: eq(merchantProfile.userId, userId),
  });

  if (existing) {
    await db
      .update(merchantProfile)
      .set({ businessName, phone: phone ?? null, country: country ?? null, updatedAt: now })
      .where(eq(merchantProfile.userId, userId));
  } else {
    await db.insert(merchantProfile).values({
      userId,
      businessName,
      phone: phone ?? null,
      country: country ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const row = await db.query.merchantProfile.findFirst({
    where: eq(merchantProfile.userId, userId),
  });
  if (!row) throw new AppError(500, 'PROFILE_CREATE_FAILED', 'Failed to save merchant profile');
  return toDto(row);
}

export async function getProfileByUserId(userId: string): Promise<ProfileOutput | null> {
  const row = await getDb().query.merchantProfile.findFirst({
    where: eq(merchantProfile.userId, userId),
  });
  return row ? toDto(row) : null;
}

export type MerchantWithDevices = ProfileOutput & { email: string; deviceCount: number };

export async function listMerchants(): Promise<MerchantWithDevices[]> {
  const db = getDb();
  const profiles = await db
    .select({
      id: merchantProfile.id,
      userId: merchantProfile.userId,
      businessName: merchantProfile.businessName,
      phone: merchantProfile.phone,
      country: merchantProfile.country,
      email: user.email,
    })
    .from(merchantProfile)
    .innerJoin(user, eq(user.id, merchantProfile.userId));

  const counts = await db
    .select({ ownerId: device.ownerId, cnt: count() })
    .from(device)
    .groupBy(device.ownerId);

  const countByOwner = new Map<number, number>();
  for (const c of counts) {
    if (c.ownerId !== null) countByOwner.set(c.ownerId, c.cnt);
  }

  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    businessName: p.businessName,
    phone: p.phone,
    country: p.country,
    email: p.email,
    deviceCount: countByOwner.get(p.id) ?? 0,
  }));
}
