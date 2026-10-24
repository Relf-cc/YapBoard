import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'files.yapper.website' },
      { protocol: 'https', hostname: 'www.yapin.gg' },
    ],
  },
};

export default nextConfig;
