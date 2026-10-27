// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { exchangeCode, fetchProfile } from '@/lib/yapin';
import { createSession, upsertUser } from '@/lib/session';
import { safeNext, type LoginError } from '@/lib/next-url';
import { clientIp, rateLimit } from '@/lib/http';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  // Only a code goes in the URL; the login page has the wording, so nobody can put their own text on it.
  const fail = (code: LoginError) => NextResponse.redirect(new URL(`/login?error=${code}`, env.siteUrl));
  // Each callback costs two calls to Yapin'; real logins never come close to this.
  if (!rateLimit(`callback:${clientIp(req.headers)}`, 20, 60_000)) return fail('failed');

  let saved: { state: string; verifier: string; next: string };
  try {
    saved = JSON.parse(req.cookies.get('yb_oauth')?.value || '');
  } catch {
    return fail('expired');
  }
  if (q.get('error')) return fail(q.get('error') === 'access_denied' ? 'cancelled' : 'denied');
  const code = q.get('code');
  if (!code || q.get('state') !== saved.state) return fail('state');

  try {
    const token = await exchangeCode(code, saved.verifier);
    const profile = await fetchProfile(token);
    // STAFF_IDS isn't saved as a role: getUser applies it on each request, so removing an ID takes effect at once.
    const user = await upsertUser(profile);
    if (user.bannedAt) return fail('banned');
    await createSession(user.id);
  } catch (e) {
    console.error('[auth] callback failed', e);
    return fail('failed');
  }
  const next = safeNext(saved.next, env.portalUrl);
  const res = NextResponse.redirect(next.startsWith('http') ? next : new URL(next, env.siteUrl));
  res.cookies.set('yb_oauth', '', { path: '/api/auth', maxAge: 0 });
  return res;
}
