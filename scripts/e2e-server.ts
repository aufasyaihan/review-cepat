import { spawn } from 'node:child_process';

import { config } from 'dotenv';

/**
 * e2e server launcher (Playwright webServer).
 * - Loads .env.test (isolated DATABASE_URL = review_cepat_test)
 * - Migrates the TEST database against current schema
 * - Boots `next dev` with the test environment (never the dev database)
 *
 * Process inheritance: variables already set in process.env win over .env
 * files, so Next dev keeps DATABASE_URL pointing at the test database.
 */
config({ path: '.env.test', override: false });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://root:password@localhost:3306/review_cepat_test';
}
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = 'test-only-secret-not-for-production';
}
if (!process.env.BETTER_AUTH_URL) {
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runOnce(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

const dev = spawn(npm, ['run', 'dev'], { stdio: 'inherit', env: process.env });
dev.on('exit', (code) => process.exit(code ?? 0));
dev.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

// Run migrations against the test database before serving traffic.
runOnce(npm, ['run', 'db:migrate']).catch((err) => {
  console.error('Test database migration failed:', err);
  process.exit(1);
});
