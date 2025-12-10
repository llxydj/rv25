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

  // SECURITY FIX: Request size limits to prevent DoS attacks
  experimental: {
    serverActions: {
      bodySizeLimit: '3mb', // Match file upload limit
    },
  },

  webpack(config, { isServer }) {
    // Handle Leaflet and DOMPurify on server-side (prevent SSR errors)
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        {
          leaflet: 'commonjs leaflet',
          'react-leaflet': 'commonjs react-leaflet',
          '@react-leaflet/core': 'commonjs @react-leaflet/core',
          'isomorphic-dompurify': 'commonjs isomorphic-dompurify'
        }
      ]
    }
    
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

      // Prevent caching for login and forgot-password pages (fix 304 errors)
      {
        source: '/login',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/forgot-password',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
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
          // SECURITY FIX: Content Security Policy - prevents XSS attacks
          { 
            key: 'Content-Security-Policy', 
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; media-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.facebook.com https://*.facebook.net https://cdnjs.cloudflare.com https://res.cloudinary.com data: blob:; frame-src 'self' https://*.supabase.co https://*.facebook.com; object-src 'none'; base-uri 'self'; form-action 'self';" 
          },
          // SECURITY FIX: HSTS - enforces HTTPS connections
          { 
            key: 'Strict-Transport-Security', 
            value: 'max-age=31536000; includeSubDomains; preload' 
          },
        ],
      },
    ];
  },
};

export default nextConfig;
