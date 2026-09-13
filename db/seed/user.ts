import 'dotenv/config';
import readline from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { merchantProfile, user } from '../schema';
import { closeDb, db } from '../seed-client';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/**
 * Interactive user seed: creates a MERCHANT account with a working password
 * (hashed by Better Auth) plus an optional business profile.
 *
 *   npm run db:seed:user
 */
async function main() {
  console.log('─ Seed a user (merchant account) ─\n');
  const name = (await rl.question('Name: ')).trim();
  const email = (await rl.question('Email: ')).trim();
  const password = await rl.question('Password (min 8 chars): ');
  const businessName = (await rl.question('Business name (optional): ')).trim();

  if (!name || !email || password.length < 8) {
    console.error('Name, email, and a password of at least 8 characters are required.');
    process.exitCode = 1;
    return;
  }

  const { user: created } = await auth.api.signUpEmail({
    body: { name, email, password, callbackURL: '/' },
  });

  await db
    .update(user)
    .set({ role: 'MERCHANT', emailVerified: true })
    .where(eq(user.id, created.id));

  if (businessName) {
    const now = new Date();
    await db.insert(merchantProfile).values({
      userId: created.id,
      businessName,
      phone: null,
      country: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`\n✓ User created: ${email}`);
  console.log('  Role: MERCHANT. Log in at /login with that email and password.');
}

async function run() {
  try {
    await main();
  } catch (err) {
    console.error('User seed failed:', err);
    process.exitCode = 1;
  } finally {
    rl.close();
    await closeDb();
  }
}

void run();
