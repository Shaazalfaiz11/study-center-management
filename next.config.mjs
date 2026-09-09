/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The dashboard is behind auth and shows live operational data, so nothing
  // here should be cached by a shared proxy.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
