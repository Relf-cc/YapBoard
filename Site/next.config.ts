import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
const origin = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
};

// Forms may land on the site or the portal (login with ?next= a portal page redirects there).
const formTargets = [...new Set(["'self'", origin(process.env.NEXT_PUBLIC_SITE_URL), origin(process.env.PORTAL_URL)].filter(Boolean))].join(' ');

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
  `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action ${formTargets}`,
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
