import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { cache } from 'react';
import { db } from './db';
import { env } from './env';

const COOKIE = 'yb_session';
const MAX_AGE = 60 * 60 * 24 * 30; // matches Yapin' token lifetime

const key = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars)');
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
  const token = await new SignJWT({ sub: userId })
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

export async function destroySession() {
  (await cookies()).set(COOKIE, '', { path: '/', maxAge: 0, domain: env.cookieDomain });
}

/** The logged-in user, read fresh from the DB so role changes and bans apply at once. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, bannedAt: true },
    });
    if (!user) return null;
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
