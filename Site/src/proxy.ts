import { NextResponse, type NextRequest } from 'next/server';

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + '/');

/**
 * One Next app, three hosts:
 * - yapboard.dev is the site. Its pages call /api/* on the same origin.
 * - portal.yapboard.dev serves the staff portal at its root: /reports there is /portal/reports here.
 *   On the main domain in production, /portal redirects to the subdomain.
 * - api.yapboard.dev serves the API at its root: /servers/123 there is /api/servers/123 here.
 * In dev, localhost:3000/portal and /api work directly (and so do portal.localhost:3000 and api.localhost:3000).
 */
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

  // API routes on the site and portal hosts are served as they are.
  if (under(pathname, '/api')) return NextResponse.next();

  const onPortalHost = host.startsWith('portal.');
  const portalPath = under(pathname, '/portal');

  // First line of defence: no session cookie, no portal. (Every portal page also checks staff itself; this just
  // means anonymous requests never reach rendering at all.)
  if ((onPortalHost || portalPath) && !req.cookies.has('yb_session')) {
    const portal = (process.env.PORTAL_URL || req.nextUrl.origin).replace(/\/$/, '');
    const back = onPortalHost ? `${portal}${pathname === '/' ? '' : pathname}${search}` : `${pathname}${search}`;
    return NextResponse.redirect(`${site}/login?next=${encodeURIComponent(back)}`);
  }

  if (onPortalHost) {
    // Pretty URLs on the subdomain: /portal/reports → /reports
    if (portalPath) return NextResponse.redirect(here(pathname.slice('/portal'.length) || '/'));
    const url = req.nextUrl.clone();
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  const portalUrl = process.env.PORTAL_URL;
  if (process.env.NODE_ENV === 'production' && portalUrl && /^https?:\/\/portal\./.test(portalUrl) && portalPath) {
    return NextResponse.redirect(`${portalUrl.replace(/\/$/, '')}${pathname.slice('/portal'.length)}${search}`);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and files with an extension. API routes are included so api.* can map onto
  // them; on the other hosts they pass straight through.
  matcher: ['/((?!_next/|favicon|icon|.*\\.[a-z0-9]+$).*)'],
};
