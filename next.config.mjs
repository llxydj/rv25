// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  images: {
    domains: ['localhost', 'rvois.vercel.app'],
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  webpack(config, { isServer }) {
    // Optimize chunk splitting for map component (non-destructive)
    if (!isServer) {
      // Only customize if optimization exists, otherwise keep Next.js defaults
      if (config.optimization && config.optimization.splitChunks) {
        const existingCacheGroups = config.optimization.splitChunks.cacheGroups || {};
        
        // Add map chunk optimization without disabling existing cache groups
        config.optimization.splitChunks.cacheGroups = {
          ...existingCacheGroups, // Keep all existing cache groups
          // Map component in its own chunk (higher priority)
          map: {
            name: 'map',
            chunks: 'all',
            test: /[\\/]components[\\/]ui[\\/]map/,
            priority: 20,
            reuseExistingChunk: true,
          },
        };
      }
    }
    return config;
  },

  async headers() {
    return [
      // Serve service worker correctly
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },

      // Security headers
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
