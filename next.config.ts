import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gera .next/standalone com server.js para Dockerfile production stage (story 3.12).
  output: 'standalone',
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
