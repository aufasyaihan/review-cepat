import { config } from 'dotenv';

function deriveTestUrl(devUrl: string): string {
  const url = new URL(devUrl);
  url.pathname = '/review_cepat_test';
  return url.toString();
}

type E2eEnvironment = Record<string, string> & {
  NODE_ENV: 'development' | 'production' | 'test';
};

export function configureE2eEnvironment(): E2eEnvironment {
  config();

  process.env.DATABASE_URL = process.env.DATABASE_URL
    ? deriveTestUrl(process.env.DATABASE_URL)
    : 'mysql://root:password@localhost:3306/review_cepat_test';
  process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET
    ? `${process.env.BETTER_AUTH_SECRET}-test`
    : 'test-only-secret-not-for-production';
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

  // Parallel workers share one IP; disable Better Auth rate limiting for e2e.
  process.env.DISABLE_RATE_LIMIT = '1';

  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    NODE_ENV: process.env.NODE_ENV ?? 'production',
  };
}
