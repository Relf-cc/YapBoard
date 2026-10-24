import { NextResponse, type NextRequest } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { env, oauthEnabled } from '@/lib/env';
import { authorizeUrl } from '@/lib/yapin';
import { safeNext } from '@/lib/next-url';

/** Starts "Login with Yapin'" (OAuth2 + PKCE). Without credentials in dev, goes to the dev login page. */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'), env.portalUrl);
  if (!oauthEnabled()) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, env.siteUrl));

  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: env.isProd, path: '/api/auth', maxAge: 600 };
  res.cookies.set('yb_oauth', JSON.stringify({ state, verifier, next }), opts);
  return res;
}
