// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from './db';
import { botEnabled, env } from './env';
import { fail, rateLimit } from './http';
import { getUser } from './session';
import { fetchServer } from './yapin';
import { APP_STATUS, appLive, ENDPOINTS, RATE, readScopes, SCOPE_ORDER, writeScopes, type Endpoint, type Scope } from './platform-scopes';

export * from './platform-scopes';

/**
 * The YapBoard developer platform: platform.yapboard.dev.
 *
 * An invite-only program. A Yapin' bot developer we've admitted can put YapBoard's commands inside their own
 * bot - `/bump`, a listing lookup, search - by calling the partner API with a key they mint on the platform.
 *
 * Invite-only on purpose. These calls act on other people's listings (a bump moves a server up the board), so
 * the bot sending them has to be one we can name, reach and switch off. Three rows carry that: the invite
 * staff wrote, the member it admitted, and the app - one bot - whose keys the API checks.
 *
 * Three gates, every request:
 *   1. the key is live (not revoked),
 *   2. its app is ACTIVE and its member is ACTIVE,
 *   3. the endpoint's scope is on the app.
 * Suspending a member stops every one of their apps without touching a key, which is what staff reach for
 * first; revoking a key stops one deployment without touching the app.
 */

/* ---------------- where we are ---------------- */

/** '' on platform.yapboard.dev (served at the root), '/platform' on the main domain (dev). */
export async function platformBase() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || '').toLowerCase().split(':')[0];
  // Already there: plain paths, so navigating within the platform stays a client-side route change.
  if (host.startsWith('platform.')) return '';

  /**
   * Reached through the main site instead. The platform has its own host in production, and a link that
   * keeps somebody on yapboard.dev/platform leaves them on a second copy of the same pages - different
   * URLs, different bookmarks, and an invite link that doesn't match where they're standing. So every
   * link out of here is absolute, and lands them on platform.yapboard.dev.
   *
   * Except in development, where there is no such host and `env.platformUrl` is the site's own /platform:
   * the path is returned as a path, and nothing changes.
   */
  try {
    const u = new URL(env.platformUrl);
    if (u.hostname.toLowerCase() === host) return trimSlash(u.pathname);
  } catch {
    // A malformed PLATFORM_URL shouldn't take the platform down: fall through to the relative path.
    return '/platform';
  }
  return env.platformUrl;
}

/** `/platform` from `/platform/`, and `''` from `/` - so `${base}${path}` never doubles a slash. */
const trimSlash = (path: string) => (path === '/' ? '' : path.replace(/\/$/, ''));

/* ---------------- invites ---------------- */

/** Crockford's base32 without the letters that get misread (I, L, O, U) - invite codes get read aloud. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** YB-XXXX-XXXX. 40 bits of randomness, which is plenty for something staff hand over by name. */
export function newInviteCode() {
  const chars = Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]);
  return `YB-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}

/** What someone typed, as a code: case and spacing don't matter, and the YB- prefix is optional. */
export function normalizeInviteCode(input: string) {
  const bare = input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^YB/, '');
  return bare.length === 8 ? `YB-${bare.slice(0, 4)}-${bare.slice(4)}` : '';
}

export const inviteOpen = (i: { redeemedAt: Date | null; revokedAt: Date | null; expiresAt: Date | null }) =>
  !i.redeemedAt && !i.revokedAt && (!i.expiresAt || i.expiresAt.getTime() > Date.now());

export type RedeemResult = { ok: true } | { ok: false; error: string };

/**
 * Redeem a code for the logged-in user. The claim and the member row are written in one transaction, so the
 * same code opened in two tabs can only ever admit once.
 */
export async function redeemInvite(code: string, userId: string): Promise<RedeemResult> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return { ok: false, error: 'That doesn’t look like an invite code' };
  const invite = await db.platformInvite.findUnique({ where: { code: normalized } });
  // One answer for a code that doesn't exist and one that isn't theirs: guessing shouldn't pay.
  if (!invite || (invite.forUserId && invite.forUserId !== userId)) return { ok: false, error: 'That code isn’t valid' };
  if (invite.revokedAt) return { ok: false, error: 'That invite was withdrawn' };
  if (invite.redeemedAt) return { ok: false, error: 'That invite has already been used' };
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) return { ok: false, error: 'That invite has expired' };
  if (await db.platformMember.findUnique({ where: { userId }, select: { userId: true } })) return { ok: false, error: 'You’re already in the program' };

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.platformInvite.updateMany({ where: { id: invite.id, redeemedAt: null, revokedAt: null }, data: { redeemedAt: new Date(), redeemedById: userId } });
      if (!claimed.count) throw new Error('taken');
      await tx.platformMember.create({ data: { userId, inviteId: invite.id, appLimit: invite.appLimit, scopes: writeScopes(readScopes(invite.scopes)) } });
    });
  } catch {
    return { ok: false, error: 'That invite has already been used' };
  }
  return { ok: true };
}

/* ---------------- the member behind a page ---------------- */

export const findMember = (userId: string) =>
  db.platformMember.findUnique({
    where: { userId },
    include: { invite: { select: { note: true, invitedBy: { select: { username: true } } } }, _count: { select: { apps: true } } },
  });

export type Member = NonNullable<Awaited<ReturnType<typeof findMember>>>;

/** Logged in, or sent to the main site's login and back here afterwards. */
export async function requirePlatformUser(path = '') {
  const user = await getUser();
  if (!user) {
    const base = await platformBase();
    const back = base ? `${base}${path}` : `${env.platformUrl}${path}`;
    redirect(`${base ? '' : env.siteUrl}/login?next=${encodeURIComponent(back)}`);
  }
  return { user, member: user.bannedAt ? null : await findMember(user.id) };
}

/**
 * Every platform page calls this before loading anything, for the same reason the portal's pages do: Next
 * renders a page alongside its layout, so a page that trusts the layout's gate still sends its data to
 * somebody the layout is showing the invite wall to.
 */
export async function requireMemberPage(path = '') {
  const { user, member } = await requirePlatformUser(path);
  if (!member) notFound();
  return { user, member };
}

/** One app with its keys. Staff may read any (the portal links here); a developer only their own. */
export async function appFor(appId: string, userId: string, staff = false) {
  const app = await db.platformApp.findUnique({
    where: { id: appId },
    include: { keys: { orderBy: { createdAt: 'desc' } }, owner: { include: { user: { select: { username: true } } } } },
  });
  if (!app || (!staff && app.ownerId !== userId)) return null;
  return app;
}

/* ---------------- keys ---------------- */

/** How much of a key is shown in the UI: enough to tell two apart, not enough to be one. */
const PREFIX_LEN = 12;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * A new key, returned once and never again: only the hash is stored, so "show me that key again" has no
 * answer - the developer mints another and revokes the old one, which is also how rotation works.
 */
export async function mintKey(appId: string, label: string) {
  const secret = `ybp_${randomBytes(24).toString('base64url')}`;
  const row = await db.platformKey.create({
    data: { appId, label: label.slice(0, 40), prefix: secret.slice(0, PREFIX_LEN), hash: sha256(secret) },
    select: { id: true, prefix: true, createdAt: true },
  });
  return { ...row, secret };
}

/** The key on a request: `Authorization: Bearer ybp_…`. */
export function bearer(req: Request) {
  const raw = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return /^ybp_[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : '';
}

export type Auth =
  | { ok: true; app: { id: string; botId: string; name: string; scopes: Scope[] }; keyId: string }
  | { ok: false; error: string; status: number };

/**
 * Who is calling, if anybody. Looked up by hash, since the key itself is never stored; the hashes are still
 * compared byte for byte, because a lookup that leaked timing would leak which hashes exist.
 */
export async function authenticate(req: Request): Promise<Auth> {
  const secret = bearer(req);
  if (!secret) return { ok: false, error: 'Send your key as `Authorization: Bearer ybp_…`', status: 401 };
  const hash = sha256(secret);
  const key = await db.platformKey.findUnique({
    where: { hash },
    select: {
      id: true,
      hash: true,
      revokedAt: true,
      app: { select: { id: true, botId: true, name: true, scopes: true, status: true, statusNote: true, owner: { select: { status: true } } } },
    },
  });
  if (!key || !timingSafeEqual(Buffer.from(key.hash), Buffer.from(hash))) return { ok: false, error: 'Unknown key', status: 401 };
  if (key.revokedAt) return { ok: false, error: 'That key was revoked', status: 401 };
  const app = key.app;
  if (app.owner.status !== 'ACTIVE') return { ok: false, error: 'This developer account is suspended. See platform.yapboard.dev.', status: 403 };
  if (!appLive(app.status)) {
    return { ok: false, error: `This app is ${(APP_STATUS[app.status] ?? 'not active').toLowerCase()}${app.statusNote ? `: ${app.statusNote}` : ''}`, status: 403 };
  }
  return { ok: true, app: { id: app.id, botId: app.botId, name: app.name, scopes: readScopes(app.scopes) }, keyId: key.id };
}

/* ---------------- usage ---------------- */

const midnightUtc = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * What an answer was, in one word, for PlatformOutcome.
 *
 * A 200 isn't automatically a success here: a bump turned down for a cooldown is a 200 with `ok: false`, and
 * that's the single most useful thing a developer can see about their own integration. Refusals carry a
 * `reason`, so that becomes the outcome; anything else is `ok` or the status it answered with.
 */
export async function outcomeOf(res: NextResponse, endpoint: Endpoint): Promise<{ outcome: string; refused: boolean }> {
  if (res.status >= 400) return { outcome: `http_${res.status}`, refused: false };
  // Only the bump endpoints answer with ok/reason, so only they are worth reading back.
  if (!endpoint.startsWith('bump')) return { outcome: 'ok', refused: false };
  try {
    const body = (await res.clone().json()) as { ok?: boolean; reason?: string };
    if (body?.ok === false) return { outcome: typeof body.reason === 'string' ? body.reason.slice(0, 32) : 'refused', refused: true };
  } catch {
    // A body that won't parse isn't worth failing a request over; count it as served.
  }
  return { outcome: 'ok', refused: false };
}

/**
 * Counts one call: the rollup on PlatformUsage and the app, and the detail on PlatformOutcome. Never throws
 * — a request that worked shouldn't fail because its tally didn't land, and a request that failed shouldn't
 * be masked by a second error from in here.
 */
export async function recordCall(appId: string, keyId: string, endpoint: Endpoint, ok: boolean, extra?: { outcome?: string; refused?: boolean; ms?: number }) {
  const day = midnightUtc();
  const ms = Math.max(0, Math.round(extra?.ms ?? 0));
  const refused = extra?.refused ? 1 : 0;
  const outcome = extra?.outcome ?? (ok ? 'ok' : 'error');
  await Promise.all([
    db.platformUsage.upsert({
      where: { appId_day_endpoint: { appId, day, endpoint } },
      create: { appId, day, endpoint, calls: 1, errors: ok ? 0 : 1, refused, msTotal: ms },
      update: { calls: { increment: 1 }, ...(ok ? {} : { errors: { increment: 1 } }), ...(refused ? { refused: { increment: 1 } } : {}), msTotal: { increment: ms } },
    }),
    db.platformOutcome.upsert({
      where: { appId_day_endpoint_outcome: { appId, day, endpoint, outcome } },
      create: { appId, day, endpoint, outcome, count: 1 },
      update: { count: { increment: 1 } },
    }),
    db.platformApp.update({ where: { id: appId }, data: { calls: { increment: 1 }, ...(ok ? {} : { errors: { increment: 1 } }), lastCallAt: new Date() } }),
    db.platformKey.update({ where: { id: keyId }, data: { lastUsedAt: new Date() } }),
  ]).catch(() => {});
}

/**
 * The last `days` days of one app's usage, oldest first, with every day present even at zero.
 *
 * Three numbers per day, because they mean different things: served, refused (a cooldown is not a fault) and
 * errored. A bar that's mostly refusals is a bot asking too often; one that's mostly errors is broken.
 */
export async function usageSeries(appId: string, days = 14) {
  const from = midnightUtc(new Date(Date.now() - (days - 1) * 864e5));
  const rows = await db.platformUsage.findMany({ where: { appId, day: { gte: from } }, orderBy: { day: 'asc' } });
  const sum = (list: typeof rows, key: 'calls' | 'errors' | 'refused') => list.reduce((n, r) => n + r[key], 0);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(from.getTime() + i * 864e5);
    const mine = rows.filter((r) => r.day.getTime() === day.getTime());
    return { day: day.toISOString().slice(0, 10), calls: sum(mine, 'calls'), errors: sum(mine, 'errors'), refused: sum(mine, 'refused') };
  });
}

/** Per-endpoint totals over the same window, with the average response time, for the app page. */
export async function usageByEndpoint(appId: string, days = 14) {
  const from = midnightUtc(new Date(Date.now() - (days - 1) * 864e5));
  const rows = await db.platformUsage.groupBy({ by: ['endpoint'], where: { appId, day: { gte: from } }, _sum: { calls: true, errors: true, refused: true, msTotal: true } });
  return rows
    .map((r) => {
      const calls = r._sum.calls ?? 0;
      return {
        endpoint: r.endpoint,
        calls,
        errors: r._sum.errors ?? 0,
        refused: r._sum.refused ?? 0,
        avgMs: calls ? Math.round((r._sum.msTotal ?? 0) / calls) : 0,
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

/** Every outcome one app saw over the window, commonest first: ok, cooldown, not_found, http_429\u2026 */
export async function outcomeTotals(appId: string, days = 14) {
  const from = midnightUtc(new Date(Date.now() - (days - 1) * 864e5));
  const rows = await db.platformOutcome.groupBy({ by: ['outcome'], where: { appId, day: { gte: from } }, _sum: { count: true } });
  return rows.map((r) => ({ outcome: r.outcome, count: r._sum.count ?? 0 })).sort((a, b) => b.count - a.count);
}

/**
 * How far an app's bumps reach: how many it carried, and across how many listings and people.
 *
 * Counted from the bump rows themselves (Bump.appId and friends), not from the call counters, so it says
 * what actually landed rather than what was asked for \u2014 a thousand refused bumps reach nobody.
 */
export async function reachFor(appId: string, days = 30) {
  const since = new Date(Date.now() - days * 864e5);
  const where = { appId, createdAt: { gte: since } };
  const [servers, bots, clients, people] = await Promise.all([
    db.bump.findMany({ where, distinct: ['serverId'], select: { serverId: true } }),
    db.botBump.findMany({ where, distinct: ['botId'], select: { botId: true } }),
    db.clientBump.findMany({ where, distinct: ['clientId'], select: { clientId: true } }),
    db.bump.findMany({ where, distinct: ['userId'], select: { userId: true } }),
  ]);
  const [serverBumps, botBumps, clientBumps] = await Promise.all([
    db.bump.count({ where }),
    db.botBump.count({ where }),
    db.clientBump.count({ where }),
  ]);
  return {
    days,
    bumps: serverBumps + botBumps + clientBumps,
    servers: servers.length,
    bots: bots.length,
    clients: clients.length,
    people: people.length,
  };
}

/** The whole programme, for the portal: per-day calls, and the outcomes behind them. */
export async function platformSeries(days = 14) {
  const from = midnightUtc(new Date(Date.now() - (days - 1) * 864e5));
  const rows = await db.platformUsage.groupBy({ by: ['day'], where: { day: { gte: from } }, _sum: { calls: true, errors: true, refused: true } });
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(from.getTime() + i * 864e5);
    const mine = rows.find((r) => r.day.getTime() === day.getTime());
    return { day: day.toISOString().slice(0, 10), calls: mine?._sum.calls ?? 0, errors: mine?._sum.errors ?? 0, refused: mine?._sum.refused ?? 0 };
  });
}

export async function platformOutcomes(days = 14) {
  const from = midnightUtc(new Date(Date.now() - (days - 1) * 864e5));
  const rows = await db.platformOutcome.groupBy({ by: ['outcome'], where: { day: { gte: from } }, _sum: { count: true } });
  return rows.map((r) => ({ outcome: r.outcome, count: r._sum.count ?? 0 })).sort((a, b) => b.count - a.count);
}

/** Busiest apps over the window, with the rates staff actually read: errors, refusals, wrong_server. */
export async function busiestApps(days = 14, take = 8) {
  const from = midnightUtc(new Date(Date.now() - (days - 1) * 864e5));
  const [usage, wrongServer] = await Promise.all([
    db.platformUsage.groupBy({ by: ['appId'], where: { day: { gte: from } }, _sum: { calls: true, errors: true, refused: true, msTotal: true } }),
    db.platformOutcome.groupBy({ by: ['appId'], where: { day: { gte: from }, outcome: 'wrong_server' }, _sum: { count: true } }),
  ]);
  const apps = await db.platformApp.findMany({
    where: { id: { in: usage.map((u) => u.appId) } },
    select: { id: true, name: true, botId: true, status: true, owner: { select: { user: { select: { username: true } } } } },
  });
  return usage
    .map((u) => {
      const app = apps.find((a) => a.id === u.appId);
      const calls = u._sum.calls ?? 0;
      return {
        appId: u.appId,
        name: app?.name ?? 'Deleted app',
        botId: app?.botId ?? '',
        status: app?.status ?? 'REVOKED',
        username: app?.owner.user.username ?? '?',
        calls,
        errors: u._sum.errors ?? 0,
        refused: u._sum.refused ?? 0,
        avgMs: calls ? Math.round((u._sum.msTotal ?? 0) / calls) : 0,
        wrongServer: wrongServer.find((w) => w.appId === u.appId)?._sum.count ?? 0,
      };
    })
    .sort((a, b) => b.calls - a.calls)
    .slice(0, take);
}

/* ---------------- what the forms accept ---------------- */

/** Bot ids are Yapin' snowflakes; the form only checks the shape, the way the bot listing form does. */
export const appSchema = z.object({
  botId: z.string().trim().regex(/^[0-9]{5,32}$/, 'A bot ID is 5–32 digits'),
  name: z.string().trim().min(2).max(60),
  summary: z.string().trim().max(140).optional().transform((v) => v || ''),
  contactUrl: z.string().trim().max(300).optional().transform((v) => v || null).refine((v) => !v || /^https:\/\/\S+$/.test(v), 'Use an https link'),
  scopes: z.array(z.string()).max(SCOPE_ORDER.length).default([]),
});
export type AppInput = z.input<typeof appSchema>;

/**
 * Where partner bots send their requests. API_URL when it's set (api.yapboard.dev), otherwise api.<site host>,
 * and the site's own /api in dev so a member can try calls against a local copy. One place, because this
 * string ends up in the docs, on the overview and behind every copy button.
 */
export function apiRoot() {
  if (env.apiUrl) return `${env.apiUrl}/platform/v1`;
  try {
    const u = new URL(env.siteUrl);
    if (/^(localhost|127\.|\[?::1)/.test(u.hostname)) return `${env.siteUrl}/api/platform/v1`;
    return `${u.protocol}//api.${u.hostname.replace(/^www\./, '')}/platform/v1`;
  } catch {
    return `${env.siteUrl}/api/platform/v1`;
  }
}

/* ---------------- what the bump and search endpoints share ---------------- */

/**
 * Who typed the command. Their account, never the calling bot's: a bump is credited to the person, which is
 * the rule the platform terms are built on.
 */
export const callerSchema = z.object({
  id: z.string().min(1).max(64),
  username: z.string().min(1).max(64),
  displayName: z.string().max(100).nullish(),
  avatarUrl: z.string().url().max(500).nullish(),
});
export type Caller = z.infer<typeof callerSchema>;

/**
 * Makes sure the person exists before anything is credited to them — people bump through somebody's bot
 * without ever opening the site. Answers whether they're banned, which is a turned-down bump, not an error.
 */
export async function upsertCaller(user: Caller) {
  const row = await db.user.upsert({
    where: { id: user.id },
    create: { id: user.id, username: user.username, displayName: user.displayName ?? null, avatarUrl: user.avatarUrl ?? null },
    update: {},
    select: { bannedAt: true },
  });
  return { banned: !!row.bannedAt };
}

/** `limit` on a search: 1–25, 10 by default. */
export const searchLimit = (raw: string | null) => Math.min(25, Math.max(1, parseInt(raw || '10', 10) || 10));

/**
 * Is `serverId` the listing's own server?
 *
 * A bot or client listing may only be bumped from a server it belongs to, which is what stops one busy server
 * from pushing a whole shelf of other people's bots up the board. Three ways a server qualifies, cheapest
 * first:
 *
 *   1. it's the support server on the listing itself;
 *   2. it's listed on YapBoard and its owner is the lister;
 *   3. Yapin' says its owner is the lister - the fallback for a support server that isn't listed here, since
 *      `BotListing.supportServerId` is only set once that server has a listing of its own.
 *
 * Step 3 costs a call to Yapin', so it only runs when the first two miss, and only with a bot token
 * configured. Without one (dev), a server that isn't listed here can't be vouched for.
 *
 * What this cannot do is prove the command was really typed in that server - nothing outside Yapin' can. The
 * member's app reports it, the platform terms make misreporting it a breach, and the usage counters make a
 * bot that bumps the same listing from everywhere easy to spot.
 */
export async function serverIsHome(serverId: string, listing: { ownerId: string; supportServerId: string | null }): Promise<boolean> {
  if (listing.supportServerId && listing.supportServerId === serverId) return true;
  const listed = await db.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  if (listed) return listed.ownerId === listing.ownerId;
  if (!botEnabled()) return false;
  const live = await fetchServer(serverId).catch(() => null);
  return !!live?.ownerId && live.ownerId === listing.ownerId;
}

/* ---------------- the partner API's front door ---------------- */

/**
 * Every /api/platform/v1/* route is this function plus a body. It settles the three gates in one place -
 * key, standing, scope - then the rate limit, then counts the call however it turned out. A route that
 * checked these for itself would eventually check them differently, and the way it would differ is that
 * somebody's key would work where it shouldn't.
 */
export async function handle(
  req: NextRequest,
  endpoint: Endpoint,
  fn: (app: { id: string; botId: string; name: string; scopes: Scope[] }) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (!auth.ok) return fail(auth.error, auth.status);
  const { app, keyId } = auth;

  const need = ENDPOINTS[endpoint];
  if (need && !app.scopes.includes(need)) {
    await recordCall(app.id, keyId, endpoint, false, { outcome: 'http_403' });
    return fail(`Your app doesn’t hold the \`${need}\` scope. Add it on platform.yapboard.dev.`, 403);
  }
  // Bumps are counted twice: once against the app's own ceiling, once against the lower bump ceiling.
  // One bump budget across all three boards: `need` is 'bump' whichever board the endpoint was for.
  const limited = !rateLimit(`plat:${app.id}`, RATE.perMinute, 60_000) || (need === 'bump' && !rateLimit(`plat:bump:${app.id}`, RATE.bumpPerMinute, 60_000));
  if (limited) {
    await recordCall(app.id, keyId, endpoint, false, { outcome: 'http_429' });
    return fail('Slow down - too many requests this minute', 429);
  }

  let res: NextResponse;
  const started = Date.now();
  try {
    res = await fn(app);
  } catch {
    // The developer gets a plain 500; what broke is ours to find in the logs, not theirs to read.
    res = fail('Something went wrong on our side', 500);
  }
  const ms = Date.now() - started;
  const { outcome, refused } = await outcomeOf(res, endpoint);
  await recordCall(app.id, keyId, endpoint, res.status < 400, { outcome, refused, ms });
  return res;
}

/** A link into the platform from somewhere else - the portal's tables, mainly. */
export const platformLink = (path = '') => `${env.platformUrl}${path}`;
