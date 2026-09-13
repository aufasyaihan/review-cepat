import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';

import { getDb } from '@/db';
import { account, session, user, verification } from '@/db/schema';

export type Role = 'ADMIN' | 'MERCHANT';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'mysql',
    schema: { user, session, account, verification },
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
});
