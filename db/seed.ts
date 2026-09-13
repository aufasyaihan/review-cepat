import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { device, user } from '../db/schema';
import { db } from '../db/seed-client';

async function main() {
  const adminId = randomUUID();
  const now = new Date();

  console.log('Seeding database...');

  await db.insert(user).values({
    id: adminId,
    name: 'Platform Admin',
    email: 'admin@nfc.local',
    emailVerified: true,
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  console.log('  - admin user created: admin@nfc.local / change password after first login');

  // One example unclaimed device with a claim code that is printed to the console once.
  const claimCode = randomBytes(6).toString('hex').toUpperCase();
  const deviceId = randomUUID();
  await db.insert(device).values({
    id: deviceId,
    slug: `demo-${createHash('sha256').update(deviceId).digest('hex').slice(0, 10)}`,
    name: 'Demo Device',
    status: 'UNCLAIMED',
    claimCodeHash: createHash('sha256').update(claimCode).digest('hex'),
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  - demo device created, claim code: ${claimCode} (shown once)`);

  // Insert a placeholder merchant only if desired (non-destructive seed leaves it out).

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
