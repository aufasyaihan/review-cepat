import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import readline from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { device, user } from './schema';
import { ensurePermissions, PERMISSION_ROWS } from './seed/permissions';
import { closeDb, db } from './seed-client';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  console.log('─ Database seed (admin + demo device) ─\n');
  const name = (await rl.question('Admin name: ')).trim();
  const email = (await rl.question('Admin email: ')).trim();
  const password = await rl.question('Admin password (min 8 chars): ');

  if (!name || !email || password.length < 8) {
    console.error('Name, email, and a password of at least 8 characters are required.');
    process.exitCode = 1;
    return;
  }

  const { user: admin } = await auth.api.signUpEmail({
    body: { name, email, password, callbackURL: '/' },
  });
  await db.update(user).set({ role: 'ADMIN', emailVerified: true }).where(eq(user.id, admin.id));
  await ensurePermissions(db);

  // One example unclaimed device with a claim code printed once.
  const deviceId = randomUUID();
  const claimCode = randomBytes(6).toString('hex').toUpperCase();
  const now = new Date();
  await db.insert(device).values({
    id: deviceId,
    slug: `demo-${createHash('sha256').update(deviceId).digest('hex').slice(0, 10)}`,
    name: 'Demo Device',
    status: 'UNCLAIMED',
    claimCodeHash: createHash('sha256').update(claimCode).digest('hex'),
    createdAt: now,
    updatedAt: now,
  });

  console.log(`\n✓ Admin created: ${email}`);
  console.log(`  You can now log in at /login with that email and password.`);
  console.log(
    `✓ Demo device created — claim code: ${claimCode} (shown once, distribute with the device)`,
  );
  console.log(`✓ Permission rows ready (${PERMISSION_ROWS.length} unique paths for all roles)`);
}

async function run() {
  try {
    await main();
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    rl.close();
    await closeDb();
  }
}

void run();
