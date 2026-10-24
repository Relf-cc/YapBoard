import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import { cache } from 'react';
import { db } from './db';
import { env, weakSecret } from './env';

const COOKIE = 'yb_session';
const MAX_AGE = 60 * 60 * 24 * 30; // matches Yapin' token lifetime

const key = () => {
  const s = process.env.SESSION_SECRET;
  if (weakSecret(s, 32)) throw new Error('SESSION_SECRET must be a random string of 32+ chars, not the one from .env.example');
  return new TextEncoder().encode(s);
};

export type SessionUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  bannedAt: Date | null;
};

export async function createSession(userId: string) {
  const sid = randomBytes(24).toString('base64url');
  const now = Date.now();
  await db.$transaction([
    db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date(now) } } }),
    db.session.create({ data: { id: sid, userId, expiresAt: new Date(now + MAX_AGE * 1000) } }),
  ]);
  const token = await new SignJWT({ sub: userId, sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: MAX_AGE,
    domain: env.cookieDomain,
  });
}

/** The session id inside a valid cookie, or null. */
async function readToken(): Promise<{ sub: string; sid: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' && typeof payload.sid === 'string' ? { sub: payload.sub, sid: payload.sid } : null;
  } catch {
    return null;
  }
}

/** Logs this browser out for real: the session row goes, so a copied cookie stops working too. */
export async function destroySession() {
  const t = await readToken();
  if (t) await db.session.deleteMany({ where: { id: t.sid } });
  (await cookies()).set(COOKIE, '', { path: '/', maxAge: 0, domain: env.cookieDomain, httpOnly: true, sameSite: 'lax', secure: env.isProd });
}

/** The logged-in user, read fresh from the DB so role changes and bans apply at once. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const t = await readToken();
  if (!t) return null;
  try {
    const session = await db.session.findUnique({
      where: { id: t.sid },
      select: { userId: true, expiresAt: true, user: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, bannedAt: true } } },
    });
    if (!session || session.userId !== t.sub || session.expiresAt.getTime() <= Date.now()) return null;
    const user = session.user;
    // STAFF_IDS are always admins, even before anyone grants it in the portal.
    if (env.staffIds.includes(user.id)) user.role = 'ADMIN';
    return user;
  } catch {
    return null;
  }
});

export const isStaff = (u: SessionUser | null) => !!u && (u.role === 'STAFF' || u.role === 'ADMIN');
export const isAdmin = (u: SessionUser | null) => !!u && u.role === 'ADMIN';

/** Upserts a Yapin' profile after login. */
export async function upsertUser(p: { id: string; username: string; display_name?: string | null; avatar_url?: string | null }, role?: string) {
  return db.user.upsert({
    where: { id: p.id },
    create: { id: p.id, username: p.username, displayName: p.display_name ?? null, avatarUrl: p.avatar_url ?? null, role: role ?? 'USER' },
    update: { username: p.username, displayName: p.display_name ?? null, avatarUrl: p.avatar_url ?? null, lastLoginAt: new Date(), ...(role ? { role } : {}) },
  });
}
