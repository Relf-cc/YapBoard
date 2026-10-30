// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { db } from './db';
import { proSet } from './pro';
import { LISTING_KINDS, type ListingKind } from './pro-fields';
import {
  DAY,
  HOUR,
  hoursSinceEpoch,
  log2SumExp,
  NEW_ACCOUNT_TRUST,
  RANKING_DEFAULTS,
  rankingSchema,
  SIGNALS,
  WARNED_TRUST,
  type BoardWeights,
  type RankingConfig,
  type Signal,
} from './ranking-fields';
import { DEFAULT_BOARD_MEAN, ratingFactor } from './ratings';

/**
 * The "Active" ranking: how much real, recent, human activity a listing has, as one sortable number.
 *
 * `rankedAt` (src/lib/votes.ts) is untouched by any of this and still drives "Recently bumped", because
 * that sort is a promise - bump your server, go to the top - that owners organise around and the bot's
 * reminders are built on. This is a second, separate number for a second, separate sort.
 *
 * ## The one idea that makes it work: never store a decayed score
 *
 * Activity has to decay, or the board freezes. But a decayed score is only comparable with another decayed
 * score worked out in the same instant. Store "the value as of when I last touched this row" and two rows
 * touched an hour apart are no longer comparable - so the ordering is quietly wrong for everything a sweep
 * hasn't reached yet, which is the worst kind of wrong: invisible, and worse the busier the board gets.
 *
 * So `hotScore` is not a decayed score. It is the decay kernel's numerator, in log2, anchored to a fixed
 * epoch:
 *
 *     hotScore = log2( Σ wᵢ · trustᵢ · 2^(tᵢ / H) ) + log2(factors) − penalty
 *
 * where `tᵢ` is hours since RANK_EPOCH. The score a person would actually mean - the decayed one - is
 * `hotScore − T/H` at any moment `T`. But `T/H` is the same for every row on the board, so it cannot
 * change anybody's position, and dropping it is what makes `ORDER BY hotScore DESC` correct at every
 * instant, forever, with nothing recomputing anything. A row written last month still sorts correctly
 * against one written a second ago.
 *
 * The sweep that does exist is therefore not keeping the ordering alive. It only picks up changes to the
 * *inputs* - a plan lapsing, a setting changing, a per-actor cap now biting differently - which is a much
 * weaker thing to depend on, and a much safer one to be late with.
 *
 * Two consequences worth knowing before touching this:
 *
 * - **The number grows by about 1 every half-life** (so ~1 every 3 days at the defaults) and keeps growing
 *   for as long as the board exists. That is correct. Because it is stored in log2 there is nothing to
 *   overflow - after a decade it is a three-digit float - and it is only ever compared with other scores
 *   from the same board, never read as a quantity of anything.
 * - **Sums are accumulated with log-sum-exp**, never by exponentiating and adding. `2^(t/H)` for a `t`
 *   measured in years overflows a double long before the log of it gets interesting.
 *
 * A score of exactly 0 means "no counted activity at all", which is unambiguous: a real score is
 * `log2(w) + t/H` for a `t` in the thousands of hours, so every listing with so much as one counted event
 * scores in the dozens or hundreds. Nothing real ever lands on 0.
 *
 * ## Why the unit of credit is the person, not the event
 *
 * Everything anti-spam here comes from one choice: a listing's activity is a sum over *actors*, each
 * contributing at most `cap` events. One person replying ten times is one person. Ten people replying once
 * each is ten. The arithmetic simply has no lever an owner can pull alone, which is better than detecting
 * that they pulled it.
 */

/**
 * The shape, the defaults and the pure arithmetic live in ranking-fields.ts so the portal's controls can
 * import them in the browser. Re-exported here so server code has one import for the whole subject.
 */
export {
  RANK_EPOCH,
  SIGNALS,
  rankingSchema,
  RANKING_DEFAULTS,
  WINDOW_NOTE,
  PAGE_ONE,
  NEW_ACCOUNT_TRUST,
  WARNED_TRUST,
  MIN_COUNTED_REVIEW,
  MIN_COUNTED_REPLY,
  log2SumExp,
  hoursSinceEpoch,
  factorAsHours,
  shouldCount,
  type Signal,
  type RankingConfig,
  type BoardWeights,
  type CountableComment,
} from './ranking-fields';

/* ------------------------------------------------------------------ settings */

/** Saved settings over the defaults, per key, so a half-written row can never break the board. Once per request. */
export const getRankingConfig = cache(async (): Promise<RankingConfig> => {
  const row = await db.setting.findUnique({ where: { key: 'ranking' } });
  let saved: Record<string, unknown> = {};
  try {
    saved = row ? JSON.parse(row.value) : {};
  } catch {}
  const out: RankingConfig = { ...RANKING_DEFAULTS, weights: structuredClone(RANKING_DEFAULTS.weights) };
  for (const k of Object.keys(RANKING_DEFAULTS) as (keyof RankingConfig)[]) {
    const v = rankingSchema.shape[k].safeParse(saved[k]);
    if (v.success) (out as Record<string, unknown>)[k] = v.data;
  }
  return out;
});

export async function saveRankingConfig(cfg: RankingConfig) {
  const value = JSON.stringify(cfg);
  await db.setting.upsert({ where: { key: 'ranking' }, create: { key: 'ranking', value }, update: { value } });
}

/* ------------------------------------------------------------------ scoring */

/** One scorable thing somebody did, flattened out of whichever table it came from. */
type Event = { signal: Signal; actorId: string; at: Date; ipHash: string };

export type ScoreTerms = {
  /** `log2(Σ …)`, or null when there was no counted activity at all. */
  activity: number | null;
  /** Per signal: how many events survived capping, and how many people they came from. */
  counted: Record<Signal, { events: number; actors: number }>;
  actors: number;
  diversityFactor: number;
  sizeFactor: number;
  ratingFactor: number;
  proBoost: number;
  penalty: number;
  score: number;
};

const emptyCounted = (): Record<Signal, { events: number; actors: number }> =>
  Object.fromEntries(SIGNALS.map((s) => [s, { events: 0, actors: 0 }])) as Record<Signal, { events: number; actors: number }>;

/** What a board's `sizeFactor` is measured on. Members for a server; the nearest honest equivalent elsewhere. */
const sizeOf = (kind: ListingKind, row: ListingRow) => (kind === 'server' ? row.memberCount : kind === 'bot' ? row.serverCount : row.downloads) ?? 0;

type ListingRow = {
  id: string;
  ownerId: string;
  createdAt: Date;
  reviewCount: number;
  ratingSum: number;
  memberCount?: number | null;
  serverCount?: number | null;
  downloads?: number | null;
};

/**
 * The scores for a batch of listings on one board.
 *
 * Batched on purpose: a per-listing version would be five queries each, and `refreshAllHot` would be five
 * times the board. This is a handful of queries for the whole batch, with the capping and the summing done
 * in memory - the same shape `proSet` already uses for the same reason.
 */
export async function scoreListings(kind: ListingKind, ids: readonly string[], cfg: RankingConfig): Promise<Map<string, ScoreTerms>> {
  const out = new Map<string, ScoreTerms>();
  if (!ids.length) return out;

  const since = new Date(Date.now() - cfg.windowDays * DAY);
  const idField = kind === 'server' ? 'serverId' : kind === 'bot' ? 'botId' : 'clientId';
  const where = { [idField]: { in: [...ids] }, createdAt: { gt: since } };

  const rows = await listingRows(kind, ids);
  const bumpTable = kind === 'server' ? db.bump : kind === 'bot' ? db.botBump : db.clientBump;

  const [comments, bumps, votes] = await Promise.all([
    db.comment.findMany({
      where: { ...where, counts: true, hiddenAt: null },
      select: { serverId: true, botId: true, clientId: true, userId: true, rating: true, ipHash: true, createdAt: true },
    }),
    // Bumps carry no network of their own; the cooldown and the per-actor cap are what hold them down.
    (bumpTable as { findMany: (a: unknown) => Promise<{ userId: string; createdAt: Date }[]> }).findMany({
      where,
      select: { [idField]: true, userId: true, createdAt: true },
    }) as Promise<Record<string, unknown>[]>,
    kind === 'server'
      ? db.vote.findMany({ where: { ...where, revokedAt: null }, select: { serverId: true, userId: true, ipHash: true, createdAt: true } })
      : Promise.resolve([] as { serverId: string; userId: string; ipHash: string; createdAt: Date }[]),
  ]);

  /** listingId -> events */
  const byListing = new Map<string, Event[]>(ids.map((id) => [id, []]));
  const push = (listingId: string | null | undefined, e: Event) => {
    if (listingId) byListing.get(listingId)?.push(e);
  };
  for (const c of comments) {
    push((c.serverId ?? c.botId ?? c.clientId) as string, { signal: c.rating === null ? 'reply' : 'review', actorId: c.userId, at: c.createdAt, ipHash: c.ipHash });
  }
  for (const b of bumps) {
    push(b[idField] as string, { signal: 'bump', actorId: b.userId as string, at: b.createdAt as Date, ipHash: '' });
  }
  for (const v of votes) {
    push(v.serverId, { signal: 'vote', actorId: v.userId, at: v.createdAt, ipHash: v.ipHash });
  }
  // Listing itself, by its owner, so day one is not a blank. Outside the window it simply weighs nothing.
  for (const r of rows.values()) {
    if (r.createdAt > since) push(r.id, { signal: 'listed', actorId: r.ownerId, at: r.createdAt, ipHash: '' });
  }

  const actorIds = [...new Set([...byListing.values()].flat().map((e) => e.actorId))];
  const [trust, pro, penalties, mean] = await Promise.all([
    trustOf(actorIds, cfg),
    proSet(kind, ids),
    penaltiesOf(kind, ids, idField),
    boardMean(),
  ]);

  const weights = cfg.weights[kind];
  for (const id of ids) {
    const row = rows.get(id);
    if (!row) continue;
    out.set(
      id,
      combine({
        events: byListing.get(id) ?? [],
        weights,
        cfg,
        trust,
        size: sizeOf(kind, row),
        rating: ratingFactor(row.ratingSum, row.reviewCount, mean),
        pro: pro.has(id) ? cfg.proBoost : 1,
        penalty: penalties.get(id) ?? 0,
      }),
    );
  }
  return out;
}

/** The arithmetic, with every input already in hand. Pure, so the portal's explain screen can show its work. */
function combine(input: {
  events: readonly Event[];
  weights: BoardWeights;
  cfg: RankingConfig;
  trust: Map<string, number>;
  size: number;
  rating: number;
  pro: number;
  penalty: number;
}): ScoreTerms {
  const { events, weights, cfg, trust, size, rating, pro, penalty } = input;
  const counted = emptyCounted();

  /**
   * Collapse one network to one person, per signal, per listing. Many accounts on one connection is the
   * cheapest way to look like many people, and it is the one thing the per-actor cap on its own misses.
   * Bumps have no network recorded, so they arrive with an empty hash and are left alone.
   */
  const keep: Event[] = [];
  const seenNetwork = new Set<string>();
  for (const e of [...events].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    if (e.ipHash) {
      const key = `${e.signal}:${e.ipHash}`;
      if (seenNetwork.has(key)) continue;
      seenNetwork.add(key);
    }
    keep.push(e);
  }

  // Newest first already, so "the first `cap` we see" is "the most recent `cap`".
  const perActor = new Map<string, number>();
  let activity = -Infinity;
  const actorsPerSignal = new Map<Signal, Set<string>>(SIGNALS.map((s) => [s, new Set()]));
  const allActors = new Set<string>();

  for (const e of keep) {
    const { w, cap } = weights[e.signal];
    if (w <= 0 || cap <= 0) continue;
    const t = trust.get(e.actorId) ?? 1;
    if (t <= 0) continue;
    const key = `${e.actorId}:${e.signal}`;
    const used = perActor.get(key) ?? 0;
    if (used >= cap) continue;
    perActor.set(key, used + 1);

    activity = log2SumExp(activity, Math.log2(w * t) + hoursSinceEpoch(e.at) / cfg.halfLifeHours);
    counted[e.signal].events++;
    actorsPerSignal.get(e.signal)!.add(e.actorId);
    allActors.add(e.actorId);
  }
  for (const s of SIGNALS) counted[s].actors = actorsPerSignal.get(s)!.size;

  const actors = allActors.size;
  const diversityFactor = actors ? actors / (actors + cfg.diversityK) : 0;
  const sizeFactor = 1 + cfg.sizeCoefficient * Math.log10(size + 1);

  const score =
    activity === -Infinity || diversityFactor === 0
      ? 0
      : activity + Math.log2(diversityFactor) + Math.log2(sizeFactor) + Math.log2(rating) + Math.log2(pro) - penalty;

  return {
    activity: activity === -Infinity ? null : activity,
    counted,
    actors,
    diversityFactor,
    sizeFactor,
    ratingFactor: rating,
    proBoost: pro,
    penalty,
    // A score below zero would sort under "no activity at all", which is not what a penalty is for.
    score: Math.max(0, score),
  };
}

/** The rows each board keeps its own name for, fetched as one shape. */
async function listingRows(kind: ListingKind, ids: readonly string[]): Promise<Map<string, ListingRow>> {
  const where = { id: { in: [...ids] } };
  const base = { id: true, ownerId: true, createdAt: true, reviewCount: true, ratingSum: true } as const;
  const rows: ListingRow[] =
    kind === 'server'
      ? await db.server.findMany({ where, select: { ...base, memberCount: true } })
      : kind === 'bot'
        ? await db.botListing.findMany({ where, select: { ...base, serverCount: true } })
        : await db.clientListing.findMany({ where, select: { ...base, downloads: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * How much each actor's activity is worth.
 *
 * Deliberately absent: whether the actor has a Pro plan. Pro buys reach for a listing somebody owns (§4 of
 * docs/community-and-ranking.md); letting it also weight their vote on *somebody else's* listing would be
 * pay-to-vote, which is the line between a boost and a rigged board.
 */
async function trustOf(actorIds: readonly string[], cfg: RankingConfig): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!actorIds.length) return out;
  const ids = [...new Set(actorIds)];
  const minAge = cfg.minAccountAgeHours * HOUR;
  const [users, warned] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, createdAt: true, bannedAt: true } }),
    // Somebody staff have hidden a comment of lately is not banned, and is not trusted either.
    db.comment.findMany({
      where: { userId: { in: ids }, hiddenAs: 'staff', hiddenAt: { gt: new Date(Date.now() - 90 * DAY) } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);
  const flagged = new Set(warned.map((w) => w.userId));
  for (const u of users) {
    if (u.bannedAt) out.set(u.id, 0);
    else if (Date.now() - u.createdAt.getTime() < minAge) out.set(u.id, NEW_ACCOUNT_TRUST);
    else if (flagged.has(u.id)) out.set(u.id, WARNED_TRUST);
    else out.set(u.id, 1);
  }
  return out;
}

/**
 * What a listing has had held against it, in log2 units - so a penalty of 1.0 halves the score, which at the
 * default half-life is worth three days of age.
 *
 * Everything decays. A listing that was cleaned up a month ago should come back on its own, rather than
 * waiting for a staff member to remember to forgive it.
 */
async function penaltiesOf(kind: ListingKind, ids: readonly string[], idField: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const [reports, hidden] = await Promise.all([
    db.report.findMany({
      where: { [idField]: { in: [...ids] }, kind: 'ABUSE', status: 'ACTIONED', handledAt: { gt: new Date(Date.now() - 90 * DAY) } },
      select: { [idField]: true, handledAt: true },
    }) as Promise<Record<string, unknown>[]>,
    db.comment.findMany({
      where: { [idField]: { in: [...ids] }, hiddenAs: 'staff', hiddenAt: { gt: new Date(Date.now() - 30 * DAY) } },
      select: { [idField]: true, hiddenAt: true },
    }) as Promise<Record<string, unknown>[]>,
  ]);
  const add = (id: string, n: number) => out.set(id, (out.get(id) ?? 0) + n);
  const fade = (at: Date | null | undefined, days: number) => (at ? Math.max(0, 1 - (Date.now() - at.getTime()) / (days * DAY)) : 0);

  const reportTotals = new Map<string, number>();
  for (const r of reports) reportTotals.set(r[idField] as string, (reportTotals.get(r[idField] as string) ?? 0) + fade(r.handledAt as Date, 90));
  for (const [id, n] of reportTotals) add(id, Math.min(3, n));

  const hiddenTotals = new Map<string, number>();
  for (const h of hidden) hiddenTotals.set(h[idField] as string, (hiddenTotals.get(h[idField] as string) ?? 0) + 0.25 * fade(h.hiddenAt as Date, 30));
  for (const [id, n] of hiddenTotals) add(id, Math.min(1, n));

  return out;
}

/** The average rating across the whole board, which every listing's own rating is shrunk toward. */
export const boardMean = cache(async (): Promise<number> => {
  const agg = await db.comment.aggregate({ where: { rating: { not: null }, hiddenAt: null }, _avg: { rating: true } });
  return agg._avg.rating ?? DEFAULT_BOARD_MEAN;
});

/* ------------------------------------------------------------------ writing it down */

const table = (kind: ListingKind) => (kind === 'server' ? db.server : kind === 'bot' ? db.botListing : db.clientListing);

/** One listing's score, worked out again and saved. Call it after anything that changes an input. */
export async function refreshHot(kind: ListingKind, listingId: string, cfg?: RankingConfig) {
  const c = cfg ?? (await getRankingConfig());
  if (!c.enabled) return;
  const terms = (await scoreListings(kind, [listingId], c)).get(listingId);
  if (!terms) return;
  await (table(kind) as { update: (a: unknown) => Promise<unknown> }).update({
    where: { id: listingId },
    data: { hotScore: terms.score, hotAt: new Date() },
  });
}

/** Same, but never throws into the caller. Ranking is a nice-to-have; a bump that works is not. */
export const refreshHotQuietly = (kind: ListingKind, listingId: string) => refreshHot(kind, listingId).catch(() => {});

const BATCH = 250;

/**
 * Every listing on every board, in batches.
 *
 * Runs after a settings change, and nightly as the backstop: any drift, any call site somebody forgot, any
 * bug in an incremental path is gone by morning. That a full rebuild is affordable at all is a property
 * worth keeping - it is what makes the incremental paths safe to be wrong occasionally.
 */
export async function refreshAllHot(next?: RankingConfig): Promise<{ listings: number }> {
  const cfg = next ?? (await getRankingConfig());
  let total = 0;
  for (const kind of LISTING_KINDS) {
    if (!cfg.enabled) {
      await (table(kind) as { updateMany: (a: unknown) => Promise<unknown> }).updateMany({ data: { hotScore: 0, hotAt: null } });
      continue;
    }
    const all = await (table(kind) as { findMany: (a: unknown) => Promise<{ id: string }[]> }).findMany({ select: { id: true } });
    for (let i = 0; i < all.length; i += BATCH) {
      const slice = all.slice(i, i + BATCH).map((r) => r.id);
      const scored = await scoreListings(kind, slice, cfg);
      const now = new Date();
      await db.$transaction(
        [...scored].map(([id, terms]) =>
          (table(kind) as { update: (a: unknown) => unknown }).update({ where: { id }, data: { hotScore: terms.score, hotAt: now } }),
        ) as never,
      );
      total += scored.size;
    }
  }
  return { listings: total };
}

/** The terms behind one listing's score, for the portal's explain screen. Computes, never writes. */
export async function explainHot(kind: ListingKind, listingId: string): Promise<ScoreTerms | null> {
  const cfg = await getRankingConfig();
  return (await scoreListings(kind, [listingId], cfg)).get(listingId) ?? null;
}
