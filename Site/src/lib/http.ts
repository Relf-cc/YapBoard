import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env, weakSecret } from './env';
import { getUser, isStaff, type SessionUser } from './session';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (error: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status });

/** Browsers send Origin on POST/PATCH/DELETE; refuse ones from other sites (CSRF). */
export function sameOrigin(req: NextRequest) {
  // Every current browser also says where a request came from; that settles it even when Origin is missing.
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false;
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

/**
 * The request body as JSON, or null if it isn't JSON or is over `max` bytes. Reads at most `max` bytes, so a huge
 * (or endless chunked) body can't fill memory. Nothing the API takes is anywhere near 64 KB.
 */
export async function readJson(req: NextRequest, max = 64 * 1024): Promise<unknown> {
  if (Number(req.headers.get('content-length') || 0) > max || !req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

type Guard ={ user: SessionUser; error?: never } | { user?: never; error: NextResponse };

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
  if (weakSecret(want, 16) || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Tiny in-memory rate limiter (per process). Good enough for one instance; use Redis when scaling out. */
const buckets = new Map<string, { n: number; reset: number }>();
const MAX_BUCKETS = 50_000;
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  // Keys include IPs, so the map could grow without end: drop expired buckets, and if that's not enough, the oldest.
  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    for (const k of buckets.keys()) {
      if (buckets.size < MAX_BUCKETS * 0.9) break;
      buckets.delete(k);
    }
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= max) return false;
  b.n++;
  return true;
}

/**
 * The visitor's IP, for rate limits. Trusts the first X-Forwarded-For entry, which is right behind a proxy that
 * sets it (Vercel, Fly, nginx with proxy_set_header). Without one, people can choose their own value.
 */
export function clientIp(h: Headers) {
  return (h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || '').trim() || 'unknown';
}

/** Views and joins count once per visitor per server every 30 minutes, so refreshing can't pump the stats. */
export const countOnce = (kind: 'view' | 'join', serverId: string, h: Headers) => rateLimit(`${kind}:${serverId}:${clientIp(h)}`, 1, 30 * 60_000);
