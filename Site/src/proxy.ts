import { NextResponse, type NextRequest } from 'next/server';

/**
 * portal.yapboard.dev serves the staff portal at its root: /reports there is /portal/reports here.
 * On the main domain in production, /portal redirects to the subdomain. In dev, localhost:3000/portal
 * works directly (and so does portal.localhost:3000).
 */
export function proxy(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  const { pathname, search } = req.nextUrl;
  const onPortalHost = host.startsWith('portal.');
  const portalPath = pathname === '/portal' || pathname.startsWith('/portal/');

  // First line of defence: no session cookie, no portal. (Every portal page also checks staff itself; this just
  // means anonymous requests never reach rendering at all.)
  if ((onPortalHost || portalPath) && !req.cookies.has('yb_session')) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '');
    const portal = (process.env.PORTAL_URL || req.nextUrl.origin).replace(/\/$/, '');
    const back = onPortalHost ? `${portal}${pathname === '/' ? '' : pathname}${search}` : `${pathname}${search}`;
    return NextResponse.redirect(`${site}/login?next=${encodeURIComponent(back)}`);
  }

  if (onPortalHost) {
    // Pretty URLs on the subdomain: /portal/reports → /reports
    if (pathname === '/portal' || pathname.startsWith('/portal/')) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.slice('/portal'.length) || '/';
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  const portalUrl = process.env.PORTAL_URL;
  if (process.env.NODE_ENV === 'production' && portalUrl && /^https?:\/\/portal\./.test(portalUrl) && (pathname === '/portal' || pathname.startsWith('/portal/'))) {
    return NextResponse.redirect(`${portalUrl.replace(/\/$/, '')}${pathname.slice('/portal'.length)}${search}`);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, API routes and files with an extension.
  matcher: ['/((?!_next/|api/|favicon|icon|.*\\.[a-z0-9]+$).*)'],
};
