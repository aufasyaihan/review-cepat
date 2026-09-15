import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { configureE2eEnvironment } from './e2e-env';

/**
 * Finite setup tasks run before Playwright.
 * - Loads the dev .env purely for the MySQL credentials
 * - Forces DATABASE_URL to review_cepat_test (e2e never touches the dev DB)
 * - Builds the production artifact, then migrates + seeds the TEST database
 * - Playwright owns `next start` directly so shutdown is reliable on Windows
 */
const e2eEnv = configureE2eEnvironment();

function runOnce(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: e2eEnv,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function runNpmScript(script: string) {
  if (process.platform === 'win32') {
    return runOnce(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}`]);
  }

  return runOnce('npm', ['run', script]);
}

async function main() {
  const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

  if (process.argv.includes('--build-only')) {
    await runOnce(process.execPath, [nextBin, 'build']);
    return;
  }

  if (process.argv.includes('--prepare-only')) {
    await runNpmScript('db:migrate');
    await runNpmScript('db:seed:e2e');
    return;
  }

  throw new Error('Expected --build-only or --prepare-only');
}

main().catch((err) => {
  console.error('e2e server bootstrap failed:', err);
  process.exit(1);
});
