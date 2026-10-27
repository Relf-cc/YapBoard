// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
// Failover in front of yapboard.dev.
//
// Normally this is a transparent pass-through to the tunnel. When the home server is unreachable --
// cloudflared down, Docker down, power cut -- Cloudflare's own 1033/530 error page would show instead,
// so we serve the maintenance page from Pages and answer 503 Service Unavailable.
//
// The origin is reached through origin.yapboard.dev rather than yapboard.dev, because a subrequest to
// yapboard.dev would come straight back through this Worker. That hostname is a second public hostname
// on the same tunnel, with httpHostHeader set to yapboard.dev so Caddy and the Next app still see the
// Host they route on.

const ORIGIN = 'https://origin.yapboard.dev';
// The maintenance page, deployed from StaticSite/. On the current Cloudflare Pages (now part of
// Workers) this is a workers.dev URL rather than the pages.dev one the older docs describe.
const FALLBACK = 'https://yapboard-maintenance.christianjamesrelf.workers.dev';

// Only these mean "the origin is not there". A plain 500 from the app is a real bug in the app, and
// hiding it behind a maintenance page would make it much harder to notice, so it passes straight through.
//   521 web server is down      522 connection timed out    523 origin unreachable
//   524 timeout                 525/526 TLS handshake       530 (1033) tunnel error
const ORIGIN_DOWN = new Set([502, 503, 504, 521, 522, 523, 524, 525, 526, 527, 530]);

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const target = new URL(ORIGIN);
    target.pathname = incoming.pathname;
    target.search = incoming.search;

    // WebSockets cannot survive being rebuilt into a new Request, so hand them over untouched.
    if (request.headers.get('Upgrade') === 'websocket') {
      try {
        return await fetch(new Request(target, request));
      } catch {
        return downResponse(request, incoming);
      }
    }

    try {
      const headers = new Headers(request.headers);
      headers.set('X-Forwarded-Host', incoming.host);
      headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''));

      const response = await fetch(
        new Request(target, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
          redirect: 'manual',
        }),
        { signal: AbortSignal.timeout(10_000) },
      );

      if (ORIGIN_DOWN.has(response.status)) return await downResponse(request, incoming);
      return response;
    } catch {
      // Thrown when the tunnel is gone entirely, or the 10s budget runs out.
      return await downResponse(request, incoming);
    }
  },
};

async function downResponse(request, incoming) {
  // Anything programmatic wants JSON. Handing the bot a page of HTML it cannot parse turns one
  // outage into two problems.
  const wantsJson =
    incoming.pathname.startsWith('/api/') ||
    (request.headers.get('Accept') || '').includes('application/json');

  if (wantsJson) {
    return json({ error: 'service_unavailable', message: 'YapBoard is temporarily unavailable.' });
  }

  try {
    const page = await fetch(`${FALLBACK}/`, {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!page.ok) return plain();

    const headers = new Headers(page.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('Retry-After', '60');
    return new Response(request.method === 'HEAD' ? null : page.body, { status: 503, headers });
  } catch {
    // Pages is down too. Vanishingly unlikely, but the visitor still gets a straight answer.
    return plain();
  }
}

const BASE = {
  'Cache-Control': 'no-store',
  'Retry-After': '60',
};

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: { ...BASE, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function plain() {
  return new Response('YapBoard is temporarily unavailable.', {
    status: 503,
    headers: { ...BASE, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
