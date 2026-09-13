import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';

import { configureE2eEnvironment } from './e2e-env';

const SERVER_URL = 'http://localhost:3000';
const STARTUP_TIMEOUT_MS = 30_000;

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => child.once('exit', () => resolve()));
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;

  const exited = waitForExit(server);
  server.kill();
  await exited;
}

async function waitForServer(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`Next.js exited before becoming ready (code ${server.exitCode ?? 'none'})`);
    }

    try {
      const response = await fetch(SERVER_URL);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Next.js did not become ready within ${STARTUP_TIMEOUT_MS}ms`);
}

export default async function globalSetup() {
  const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const server = spawn(process.execPath, [nextBin, 'start'], {
    env: configureE2eEnvironment(),
    stdio: 'inherit',
  });

  try {
    await waitForServer(server);
  } catch (error) {
    await stopServer(server);
    throw error;
  }

  return async () => {
    await stopServer(server);
  };
}
