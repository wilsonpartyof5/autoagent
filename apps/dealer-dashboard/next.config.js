/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@autoagent/shared'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vehicle-images.dealerinspire.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.dealerinspire.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.marketcheck.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.mc-api.marketcheck.com',
        pathname: '/**',
      },
      // Allow any HTTPS image domain (more permissive for MarketCheck data)
      // You can restrict this later if needed for security
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
