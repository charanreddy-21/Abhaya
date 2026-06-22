/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer policy — don't leak paths in third-party requests
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions — only request what we actually use
          {
            key: 'Permissions-Policy',
            value: 'geolocation=self, microphone=self, camera=self, push=()',
          },
        ],
      },
      {
        // Long-cache static assets (hashed filenames)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Service worker — no cache so updates are picked up immediately
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Manifest — short cache
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Canonical trailing-slash redirect
      {
        source: '/sos',
        destination: '/sos/active',
        permanent: false,
      },
      {
        source: '/witness',
        destination: '/witness/alert',
        permanent: false,
      },
      {
        source: '/admin/incidents',
        destination: '/admin',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
