import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gera .next/standalone com server.js para Dockerfile production stage (story 3.12).
  output: 'standalone',
  // Next 15 promoveu de experimental.typedRoutes pra typedRoutes top-level.
  typedRoutes: true,
};

export default nextConfig;
