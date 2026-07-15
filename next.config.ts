import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default. The browser-only audio/WASM imports are
  // already dynamically loaded, so no custom Turbopack loader is required.
  turbopack: {},
  // Fix: parent workspace has its own package-lock.json — tell Next.js
  // that THIS project's root is deckflow-next, not the parent directory.
  outputFileTracingRoot: path.join(__dirname),

  // Allow the @elemaudio WASM worklet to load cross-origin via COOP/COEP headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy',  value: 'require-corp' },
        ],
      },
    ];
  },

  // Prevent Next.js from trying to bundle WASM modules server-side
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    // Treat .wasm as an asset (Next.js 15 handles this natively, but explicit is safer)
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;
