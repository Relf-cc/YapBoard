import 'server-only';
import { createHmac } from 'node:crypto';
import { cache } from 'react';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { env } from './env';
import { BUMP_COOLDOWN_MS } from './servers';

/**
 * Voting: logged-in people vote for a server, and each vote since its last bump moves it forward a little in
 * "recently bumped" (rankedAt). A bump is still the big move:
 *
 *   rankedAt = max(base, min(base + boost, last counted vote))
 *   base     = last bump (or when it was listed)
 *   boost    = min(maxBoostMinutes, minutesPerVote × votes counted since base)
 *
 * Capping at the last vote means votes can't rank a server ahead of the moment people actually voted, so a server
 * bumped just now always beats one that was only voted up. A vote counts when it isn't revoked and its voter isn't
 * banned. rankedAt is always worked out again from the Vote rows (never added to), so revoking, restoring,
 * banning and changing the settings all put the ranking exactly where it should be.
 *
 * Staff control all of it from the portal (Voting): pause it, keep votes but stop them counting, change the
 * numbers, turn it off per server, revoke a server's or a user's votes, and restore what was revoked.
 */

export const votingSchema = z.object({
  /** Off: no vote button, votes are refused, and votes don't move anything. */
  enabled: z.boolean(),
  /** Off: votes are still taken and shown, but don't move servers (to watch for abuse without it paying off). */
  affectsRanking: z.boolean(),
  minutesPerVote: z.number().int().min(0).max(30),
  /** Under the bump cooldown, so votes never add up to more than a bump. */
  maxBoostMinutes: z.number().int().min(0).max(BUMP_COOLDOWN_MS / 60_000 - 10),
  /** How often one person can vote for the same server. */
  cooldownHours: z.number().int().min(1).max(168),
  maxPerUserPerDay: z.number().int().min(1).max(500),
  /** All accounts on one network (IP) together, per day. */
  maxPerNetworkPerDay: z.number().int().min(1).max(5000),
  /** One vote per server per network per cooldown, whichever account it comes from. */
  onePerNetwork: z.boolean(),
  /** Hours since the voter's first YapBoard login. */
  minAccountAgeHours: z.number().int().min(0).max(720),
});
export type VotingConfig = z.infer<typeof votingSchema>;

export const VOTING_DEFAULTS: VotingConfig = {
  enabled: true,
  affectsRanking: true,
  minutesPerVote: 5,
  maxBoostMinutes: 60,
  cooldownHours: 12,
  maxPerUserPerDay: 20,
  maxPerNetworkPerDay: 40,
  onePerNetwork: true,
  minAccountAgeHours: 0,
};

/** Saved settings over the defaults. Anything unreadable falls back to the default for that key. Once per request. */
export const getVotingConfig = cache(async (): Promise<VotingConfig> => {
  const row = await db.setting.findUnique({ where: { key: 'voting' } });
  let saved: Record<string, unknown> = {};
  try {
    saved = row ? JSON.parse(row.value) : {};
  } catch {}
  const out = { ...VOTING_DEFAULTS };
  for (const k of Object.keys(VOTING_DEFAULTS) as (keyof VotingConfig)[]) {
    const v = votingSchema.shape[k].safeParse(saved[k]);
    if (v.success) (out as Record<string, unknown>)[k] = v.data;
  }
  return out;
});

export async function saveVotingConfig(cfg: VotingConfig) {
  await db.setting.upsert({ where: { key: 'voting' }, create: { key: 'voting', value: JSON.stringify(cfg) }, update: { value: JSON.stringify(cfg) } });
}

/** Votes that count: not revoked, and the voter isn't banned. */
const counted = { revokedAt: null, user: { bannedAt: null } } satisfies Prisma.VoteWhereInput;

/** Works rankedAt out again for one server from its votes. Call after anything that changes which votes count. */
export async function refreshRank(serverId: string, cfg?: VotingConfig, tx: Prisma.TransactionClient = db) {
  const c = cfg ?? (await getVotingConfig());
  const s = await tx.server.findUnique({ where: { id: serverId }, select: { bumpedAt: true, createdAt: true, votingOff: true } });
  if (!s) return;
  const base = s.bumpedAt ?? s.createdAt;
  let rankedAt = base;
  if (c.enabled && c.affectsRanking && !s.votingOff && c.minutesPerVote > 0) {
    const since = { serverId, createdAt: { gt: base }, ...counted };
    const [n, last] = await Promise.all([
      tx.vote.count({ where: since }),
      tx.vote.findFirst({ where: since, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    if (n && last) {
      const boosted = base.getTime() + Math.min(c.maxBoostMinutes, c.minutesPerVote * n) * 60_000;
      rankedAt = new Date(Math.max(base.getTime(), Math.min(boosted, last.createdAt.getTime())));
    }
  }
  await tx.server.update({ where: { id: serverId }, data: { rankedAt } });
}

/** After a settings change: every server back to its bump time, then the ones with votes worked out again. */
export async function refreshAllRanks(next?: VotingConfig) {
  await db.$executeRaw`UPDATE "Server" SET "rankedAt" = COALESCE("bumpedAt", "createdAt")`;
  // Pass the new settings straight after saving them: getVotingConfig is cached for the request.
  const cfg = next ?? (await getVotingConfig());
  if (!cfg.enabled || !cfg.affectsRanking) return;
  const voted = await db.vote.findMany({ where: { revokedAt: null }, distinct: ['serverId'], select: { serverId: true } });
  for (const v of voted) await refreshRank(v.serverId, cfg);
}

/** After a user's votes start or stop counting (ban, unban, revoke, restore). */
export async function refreshRanksForUser(userId: string) {
  const cfg = await getVotingConfig();
  const voted = await db.vote.findMany({ where: { userId }, distinct: ['serverId'], select: { serverId: true } });
  for (const v of voted) await refreshRank(v.serverId, cfg);
}

/** The voter's network, without keeping their IP: a keyed hash, useless outside this site. */
export const networkOf = (ip: string) => createHmac('sha256', `${process.env.SESSION_SECRET || ''}:votes`).update(ip).digest('hex').slice(0, 16);

const DAY = 24 * 60 * 60_000;
export const VOTES_SHOWN_DAYS = 30;

/** Counted votes in the last 30 days, the number shown on a listing. */
export const recentVotes = (serverId: string) =>
  db.vote.count({ where: { serverId, createdAt: { gt: new Date(Date.now() - VOTES_SHOWN_DAYS * DAY) }, ...counted } });

/** When this person can vote for this server again (null: now). */
export async function nextVoteAt(serverId: string, userId: string, cfg?: VotingConfig) {
  const c = cfg ?? (await getVotingConfig());
  const last = await db.vote.findFirst({ where: { serverId, userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  const at = last ? last.createdAt.getTime() + c.cooldownHours * 3_600_000 : 0;
  return at > Date.now() ? new Date(at) : null;
}

export type VoteResult = { ok: true; votes: number; nextAt: string } | { ok: false; error: string; status: number; nextAt?: string };

/** Every check, then the vote, then the server's rank. The caller has already checked login, ban and origin. */
export async function castVote(serverId: string, userId: string, ip: string): Promise<VoteResult> {
  const cfg = await getVotingConfig();
  if (!cfg.enabled) return { ok: false, status: 403, error: 'Voting is paused right now.' };

  const [server, user] = await Promise.all([
    db.server.findUnique({ where: { id: serverId }, select: { status: true, ownerId: true, votingOff: true } }),
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  if (!server || server.status !== 'PUBLIC') return { ok: false, status: 404, error: 'This server can’t get votes right now.' };
  if (server.votingOff) return { ok: false, status: 403, error: 'Voting is off for this server.' };
  if (server.ownerId === userId) return { ok: false, status: 403, error: 'You can’t vote for your own server.' };
  if (!user || Date.now() - user.createdAt.getTime() < cfg.minAccountAgeHours * 3_600_000) {
    return { ok: false, status: 403, error: `New accounts can vote ${cfg.minAccountAgeHours} hours after their first login.` };
  }

  const wait = await nextVoteAt(serverId, userId, cfg);
  if (wait) return { ok: false, status: 429, error: 'You’ve already voted for this server.', nextAt: wait.toISOString() };

  const net = networkOf(ip);
  const now = Date.now();
  const [mine, network, sameNet] = await Promise.all([
    db.vote.count({ where: { userId, createdAt: { gt: new Date(now - DAY) } } }),
    db.vote.count({ where: { ipHash: net, createdAt: { gt: new Date(now - DAY) } } }),
    cfg.onePerNetwork ? db.vote.count({ where: { serverId, ipHash: net, createdAt: { gt: new Date(now - cfg.cooldownHours * 3_600_000) } } }) : 0,
  ]);
  if (mine >= cfg.maxPerUserPerDay) return { ok: false, status: 429, error: 'That’s a lot of votes for one day. Try again tomorrow.' };
  if (network >= cfg.maxPerNetworkPerDay) return { ok: false, status: 429, error: 'Too many votes from your network today. Try again tomorrow.' };
  if (sameNet) return { ok: false, status: 429, error: 'Someone on your network already voted for this server. Try again later.' };

  await db.vote.create({ data: { serverId, userId, ipHash: net } });
  await refreshRank(serverId, cfg);
  return { ok: true, votes: await recentVotes(serverId), nextAt: new Date(now + cfg.cooldownHours * 3_600_000).toISOString() };
}
