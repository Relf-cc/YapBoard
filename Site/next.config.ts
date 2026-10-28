// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
const origin = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
};

// Forms may land on the site, the portal or the platform (login with ?next= one of their pages redirects there).
const formTargets = [...new Set(["'self'", origin(process.env.NEXT_PUBLIC_SITE_URL), origin(process.env.PORTAL_URL), origin(process.env.PLATFORM_URL)].filter(Boolean))].join(' ');
// Bug reports are posted from the browser to a Kern stream (src/components/BugReport.tsx).
const bugStream = origin(process.env.NEXT_PUBLIC_BUG_REPORT_URL);

/**
 * Inline scripts stay allowed (Next's bootstrap needs them without a nonce setup), so this mainly stops framing
 * (clickjacking), plugins, <base> hijacks and loading scripts or data from anywhere else.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Server icons and avatars come from Yapin's file hosts; any https image is fine, nothing else.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${bugStream ? ` ${bugStream}` : ''}${dev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action ${formTargets}`,
  "frame-ancestors 'none'",
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Pages opened from here (invites, links in descriptions) can't reach back into this window.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (see Dockerfile).
  output: 'standalone',
  poweredByHeader: false,
  // No client source maps in production: they would ship readable copies of all of src/.
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'files.yapper.website' },
      { protocol: 'https', hostname: 'www.yapin.gg' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
