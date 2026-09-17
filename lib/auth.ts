import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { organization } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  account,
  invitation,
  member,
  organization as organizationTable,
  session,
  user,
  verification,
} from '@/db/schema';

export type Role = 'ADMIN' | 'MERCHANT';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'mysql',
    schema: {
      user,
      session,
      account,
      verification,
      organization: organizationTable,
      member,
      invitation,
    },
  }),
  emailAndPassword: { enabled: true },
  rateLimit: {
    enabled: process.env.DISABLE_RATE_LIMIT !== '1',
    window: 60,
    max: 200,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'MERCHANT',
        input: false,
      },
      status: {
        type: 'string',
        required: false,
        defaultValue: 'ACTIVE',
        input: false,
      },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    cookiePrefix: 'auth',
  },
  hooks: {
    // FR-052: a deactivated account must not be able to sign in again.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) return;
      const row = await getDb().query.user.findFirst({
        where: eq(user.email, email.trim().toLowerCase()),
        columns: { status: true },
      });
      if (row?.status === 'DEACTIVATED') {
        throw APIError.from('FORBIDDEN', {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'This account has been deactivated. Contact an administrator.',
        });
      }
    }),
  },
  // Must be the last plugin: sets session cookies when auth APIs are called
  // from Server Actions (signIn/signUp/signOut).
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
    }),
    nextCookies(),
  ],
});
