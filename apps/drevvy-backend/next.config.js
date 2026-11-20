/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    // Exact hosts from src/lib/marketcheck/photos.ts. Credentialed MarketCheck
    // images are served same-origin by /api/inventory/photo; the optimizer
    // may still be asked for the public CDN or those upstream hosts.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.marketcheck.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.marketcheck.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mc-api.marketcheck.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'marketcheck-prod.apigee.net',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
