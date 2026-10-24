import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from './env';
import { getUser, isStaff, type SessionUser } from './session';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (error: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status });

/** Browsers send Origin on POST/PATCH/DELETE; refuse ones from other sites (CSRF). */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    return o.host === host || o.origin === env.siteUrl || o.origin === new URL(env.portalUrl).origin;
  } catch {
    return false;
  }
}

type Guard = { user: SessionUser; error?: never } | { user?: never; error: NextResponse };

export async function requireUser(req: NextRequest): Promise<Guard> {
  if (!sameOrigin(req)) return { error: fail('Bad origin', 403) };
  const user = await getUser();
  if (!user) return { error: fail('Log in first', 401) };
  if (user.bannedAt) return { error: fail('Your account is banned from YapBoard', 403) };
  return { user };
}

export async function requireStaff(req: NextRequest): Promise<Guard> {
  const g = await requireUser(req);
  if (g.error) return g;
  if (!isStaff(g.user)) return { error: fail('Staff only', 403) };
  return g;
}

/** The bot authenticates with `Authorization: Bearer <INTERNAL_API_SECRET>`. */
export function isInternal(req: NextRequest) {
  const want = env.internalSecret;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!want || want.length < 16 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Tiny in-memory rate limiter (per process). Good enough for one instance; use Redis when scaling out. */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= max) return false;
  b.n++;
  return true;
}
