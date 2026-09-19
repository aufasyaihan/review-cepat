'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getDb } from '@/db';
import { merchantProfile, user } from '@/db/schema';
import {
  type SignInInput,
  type SignUpInput,
  signInSchema,
  signUpSchema,
} from '@/domains/auth/schemas';
import { createOrganizationForUser } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { auth, type Role } from '@/lib/auth';
import { logger } from '@/lib/logger';

export type AuthResult = { role: Role };

/** Server Action sign-in. Cookies are set via the nextCookies plugin. */
export async function signInAction(input: SignInInput): Promise<ActionResult<AuthResult>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail('Enter valid credentials');

  try {
    const { user: authenticated } = await auth.api.signInEmail({
      body: parsed.data,
    });
    if (!authenticated) {
      return fail('Sign in failed');
    }
    const role = ((authenticated as { role?: Role }).role ?? 'MERCHANT') as Role;
    revalidatePath('/', 'layout');
    return ok({ role });
  } catch (err) {
    logger.error({ err }, 'sign in failed');
    return fail(err instanceof Error ? err.message : 'Sign in failed');
  }
}

/** Server Action registration: creates the user, promotes to MERCHANT, adds
 * profile, and creates an organization the user owns. */
export async function signUpAction(input: SignUpInput): Promise<ActionResult<AuthResult>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid registration details';
    return fail(message);
  }

  try {
    const { user: created } = await auth.api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
    });
    if (!created) {
      return fail('Registration failed');
    }

    const db = getDb();
    const now = new Date();
    await db
      .update(user)
      .set({ role: 'MERCHANT', emailVerified: true })
      .where(eq(user.id, created.id));

    await db.insert(merchantProfile).values({
      userId: created.id,
      businessName: parsed.data.businessName,
      phone: parsed.data.phone,
      country: null,
      createdAt: now,
      updatedAt: now,
    });

    await createOrganizationForUser(created.id, parsed.data.businessName);

    revalidatePath('/', 'layout');
    return ok({ role: 'MERCHANT' });
  } catch (err) {
    logger.error({ err }, 'registration failed');
    return fail(err instanceof Error ? err.message : 'Registration failed');
  }
}

export async function signOutAction(): Promise<ActionResult<void>> {
  try {
    await auth.api.signOut({ headers: await headers() });
    revalidatePath('/', 'layout');
    return ok(undefined);
  } catch (err) {
    logger.error({ err }, 'sign out failed');
    return fail('Sign out failed');
  }
}
