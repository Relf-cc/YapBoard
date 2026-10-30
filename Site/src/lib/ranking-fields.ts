// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * The ranking's shape and its arithmetic, with no database in it.
 *
 * Split out of engagement.ts for the reason pro-fields.ts is split out of pro.ts: that file is
 * 'server-only' and the portal's controls run in the browser. The controls need the schema (to validate
 * what somebody typed before sending it), the signal list (to lay the weights out) and `factorAsHours`
 * (to show each multiplier as the age it is worth, which is the whole point of that screen).
 *
 * Everything here is pure. The scoring, the queries and the writing all stay in engagement.ts.
 */
import { z } from 'zod';

/** Hours since this instant are what the decay exponent is measured in. Fixed forever. */
export const RANK_EPOCH = Date.UTC(2026, 0, 1);

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Signals that exist as rows with a person attached to them. Nothing else can be scored honestly. */
export const SIGNALS = ['review', 'reply', 'bump', 'vote', 'listed'] as const;
export type Signal = (typeof SIGNALS)[number];

const signalSchema = z.object({
  /** Relative, not absolute: doubling every weight changes nothing, since they sit inside a log of a sum. */
  w: z.number().min(0).max(1000),
  /** Most events from one person, on one listing, that count. 0 turns the signal off for that board. */
  cap: z.number().int().min(0).max(100),
});

const boardSchema = z.object({
  review: signalSchema,
  reply: signalSchema,
  bump: signalSchema,
  vote: signalSchema,
  listed: signalSchema,
});

export const rankingSchema = z.object({
  /** Off: nothing is computed, and "Active" disappears from the sort menu. */
  enabled: z.boolean(),
  /**
   * Off: scores are computed and visible in the portal, but sort nothing. How this ships, and the same
   * safety catch voting has - a ranking you have watched for a week is a different proposition from one
   * switched on from a spreadsheet.
   */
  affectsRanking: z.boolean(),
  /** Everything else is measured against this. 72h means activity is worth half as much every three days. */
  halfLifeHours: z.number().int().min(6).max(720),
  /** How far back a rebuild looks. A cost decision, not a meaning one - see `WINDOW_NOTE`. */
  windowDays: z.number().int().min(3).max(90),
  /** Shrinkage in `actors / (actors + K)`. Bigger punishes a listing with few distinct people harder. */
  diversityK: z.number().min(0).max(20),
  /** `1 + c · log10(size + 1)`. A weak prior that bigger is a safer click, nothing more. */
  sizeCoefficient: z.number().min(0).max(0.5),
  /** What a YapBoard Pro plan multiplies the activity term by. See src/lib/pro.ts for what Pro is. */
  proBoost: z.number().min(1).max(2),
  /** Hours since the actor's first login, under which their activity counts at `NEW_ACCOUNT_TRUST`. */
  minAccountAgeHours: z.number().int().min(0).max(720),
  /** Phase 3b. 0 computes the overlap and shows it in the portal without subtracting anything. */
  ringDamping: z.number().min(0).max(1),
  weights: z.object({ server: boardSchema, bot: boardSchema, client: boardSchema }),
});

export type RankingConfig = z.infer<typeof rankingSchema>;
export type BoardWeights = z.infer<typeof boardSchema>;

/**
 * Weights read as time, which is the only way to sanity-check them: two contributions are equal when
 * `Δt = H · log2(w₁ / w₂)`. At these numbers a reply posted now is worth a review from four and a half
 * days ago, and a bump now is worth a review from a day and a half ago. If those sentences sound wrong,
 * these numbers are wrong - a far better test than staring at them.
 *
 * Per board, because the boards do not offer the same signals: a client cannot be voted on. Writing the
 * missing signal as a zero would rank every client below every server for a reason that has nothing to do
 * with clients, so each board gets its own table and its own balance.
 */
const SERVER_WEIGHTS: BoardWeights = {
  review: { w: 14, cap: 1 },
  reply: { w: 5, cap: 3 },
  // Capped at 4 per person: a bump is one per 2h per server, so without a cap one devoted member is twelve
  // a day. Owner bumps count - zeroing them would break the loop the bot and the whole product run on -
  // and `diversityFactor` is what stops a server only its owner touches from going anywhere.
  bump: { w: 10, cap: 4 },
  vote: { w: 6, cap: 2 },
  // One-off, so that a listing on its first day is not invisible while it waits for anybody to arrive.
  listed: { w: 8, cap: 1 },
};

const BOT_WEIGHTS: BoardWeights = {
  review: { w: 14, cap: 1 },
  reply: { w: 5, cap: 3 },
  bump: { w: 10, cap: 4 },
  // Bots and clients cannot be voted on, so the signal is off rather than quietly worth nothing.
  vote: { w: 0, cap: 0 },
  listed: { w: 8, cap: 1 },
};

const CLIENT_WEIGHTS: BoardWeights = { ...BOT_WEIGHTS };

export const RANKING_DEFAULTS: RankingConfig = {
  enabled: true,
  affectsRanking: false,
  halfLifeHours: 72,
  windowDays: 30,
  diversityK: 2,
  sizeCoefficient: 0.08,
  proBoost: 1.25,
  minAccountAgeHours: 24,
  ringDamping: 0,
  weights: { server: SERVER_WEIGHTS, bot: BOT_WEIGHTS, client: CLIENT_WEIGHTS },
};

/**
 * Why `windowDays` is a cost decision and not a meaning one.
 *
 * At a 72-hour half-life an event 30 days old contributes 2⁻¹⁰ - under a tenth of a percent. The window is
 * 30 days because that is where the arithmetic stops mattering, so shortening it for speed changes no
 * result anybody could notice. Worth knowing before somebody trims it to 7 days and wonders why the
 * veteran listings moved.
 */
export const WINDOW_NOTE = 'Beyond ~10 half-lives a contribution is under 0.1%, so the window is a speed setting, not a rule.';

/** How many results page one of a board holds. The portal measures paid placement against this. */
export const PAGE_ONE = 23;

/** Trust for an account younger than the configured minimum. Not zero: new people are mostly just new. */
export const NEW_ACCOUNT_TRUST = 0.25;
/** Trust for somebody staff have hidden a comment of recently. */
export const WARNED_TRUST = 0.5;

/** `log2(2^a + 2^b)` without ever forming either power. The reason nothing in the scorer overflows. */
export function log2SumExp(a: number, b: number): number {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return hi + Math.log2(1 + 2 ** (lo - hi));
}

/** Hours between RANK_EPOCH and an instant. Negative for anything older, which is fine - it just weighs less. */
export const hoursSinceEpoch = (at: Date | number) => (new Date(at).getTime() - RANK_EPOCH) / HOUR;

/**
 * How much age a multiplier is worth, which is the only unit anything in this ranking can honestly be
 * compared in. A ×1.25 boost is not "25% better" - at a 72-hour half-life it is 23 hours of freshness.
 */
export const factorAsHours = (m: number, halfLifeHours: number) => halfLifeHours * Math.log2(m);

/** A review shorter than this posts fine and earns nothing. "nice" is not a review. */
export const MIN_COUNTED_REVIEW = 40;
/** A reply shorter than this earns nothing either, but the floor is far lower - "fixed, thanks" is real. */
export const MIN_COUNTED_REPLY = 15;

export type CountableComment = {
  body: string;
  rating: number | null;
  /** The person writing, and the listing they are writing under. */
  writerId: string;
  ownerId: string;
  managerIds: readonly string[];
  /** Their previous comment on this listing, for the duplicate check. */
  previousBody?: string | null;
};

/**
 * Whether a comment feeds the ranking, decided once, at write time, and stored on the row.
 *
 * Deciding it once is the point: a rebuild never has to re-judge old rows, so a change to these rules shows
 * up as a migration somebody chose to run rather than as last month's scores quietly meaning something new.
 *
 * None of these hide anything or refuse anything. Every one of them still posts, still shows, still gets
 * its badges, still gets replies. They simply do not move the board.
 */
export function shouldCount(c: CountableComment): boolean {
  const body = c.body.trim();
  if (body.length < (c.rating === null ? MIN_COUNTED_REPLY : MIN_COUNTED_REVIEW)) return false;
  // The owner and their co-managers talking on their own listing is a good thing and we want it - it is just
  // not evidence of anybody else being interested, which is the only thing this number is measuring.
  if (c.writerId === c.ownerId || c.managerIds.includes(c.writerId)) return false;
  // Posting the same paragraph twice, which is what a bored spammer does first.
  if (c.previousBody && c.previousBody.trim().toLowerCase() === body.toLowerCase()) return false;
  return true;
}
