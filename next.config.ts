import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Node.js runtime is the default and required for Drizzle/Better Auth/Pino.
  // Database-backed routes and pages opt in to dynamic rendering explicitly.
};

export default nextConfig;
