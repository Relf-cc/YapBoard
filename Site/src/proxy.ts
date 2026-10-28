// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { NextResponse, type NextRequest } from 'next/server';

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + '/');

/**
 * One Next app, four hosts:
 * - yapboard.dev is the site. Its pages call /api/* on the same origin.
 * - portal.yapboard.dev serves the staff portal at its root: /reports there is /portal/reports here.
 * - platform.yapboard.dev serves the developer platform the same way: /apps there is /platform/apps here.
 *   On the main domain in production, /portal and /platform redirect to their subdomains.
 * - api.yapboard.dev serves the API at its root: /servers/123 there is /api/servers/123 here.
 * In dev, localhost:3000/portal, /platform and /api work directly (and so do the *.localhost:3000 hosts).
 */

/**
 * The two logged-in areas on their own hostnames. Both work the same way, so they're described once:
 * `prefix` is the subdomain, `path` the folder under src/app, and `url` the env var holding the public URL.
 */
const AREAS = [
  { prefix: 'portal.', path: '/portal', url: () => process.env.PORTAL_URL },
  { prefix: 'platform.', path: '/platform', url: () => process.env.PLATFORM_URL },
] as const;

export function proxy(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  const { pathname, search } = req.nextUrl;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '');
  // req.nextUrl has the server's own address (localhost:3000), so redirects that stay on this host are built from
  // what the visitor asked for. Behind Caddy, X-Forwarded-Proto is https.
  const here = (path: string) => `${req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')}://${host}${path}${search}`;

  if (host.startsWith('api.')) {
    // One spelling: /api/servers → /servers. 308 keeps the method and body.
    if (under(pathname, '/api')) return NextResponse.redirect(here(pathname.slice('/api'.length) || '/'), 308);
    // Login cookies are set for the main domain and the OAuth redirect URI points there, so it all happens there.
    if (under(pathname, '/auth')) return NextResponse.redirect(`${site}/api${pathname}${search}`, 308);
    // The bot calls these over the Docker network only (Caddy blocks them too).
    if (under(pathname, '/internal')) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const url = req.nextUrl.clone();
    url.pathname = `/api${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // API routes on the site, portal and platform hosts are served as they are. Partner bots call
  // /api/platform/v1/* with a key of their own, so these never want a session cookie.
  if (under(pathname, '/api')) return NextResponse.next();

  const area = AREAS.find((a) => host.startsWith(a.prefix));
  const onPath = AREAS.find((a) => under(pathname, a.path));

  // First line of defence: no session cookie, no portal and no platform. (Every page behind them also checks
  // for itself; this just means anonymous requests never reach rendering at all.)
  if ((area || onPath) && !req.cookies.has('yb_session')) {
    // Come back to where they actually asked for: the hostname they used on a subdomain, the path on the
    // main domain. safeNext (src/lib/next-url.ts) only lets PORTAL_URL and PLATFORM_URL through, so an
    // unconfigured host lands on the site's front page rather than being followed.
    const back = area ? here(pathname === '/' ? '' : pathname) : `${pathname}${search}`;
    return NextResponse.redirect(`${site}/login?next=${encodeURIComponent(back)}`);
  }

  if (area) {
    // Pretty URLs on the subdomain: /portal/reports → /reports, /platform/apps → /apps
    if (onPath === area) return NextResponse.redirect(here(pathname.slice(area.path.length) || '/'));
    const url = req.nextUrl.clone();
    url.pathname = `${area.path}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // On the main domain in production, send each area to its own hostname.
  if (process.env.NODE_ENV === 'production' && onPath) {
    const away = (onPath.url() || '').replace(/\/$/, '');
    if (new RegExp(`^https?://${onPath.prefix.replace('.', '\\.')}`).test(away)) {
      return NextResponse.redirect(`${away}${pathname.slice(onPath.path.length)}${search}`);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and files with an extension. API routes are included so api.* can map onto
  // them; on the other hosts they pass straight through.
  matcher: ['/((?!_next/|favicon|icon|.*\\.[a-z0-9]+$).*)'],
};
