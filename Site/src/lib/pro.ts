// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { cache } from 'react';
import { db } from './db';
import { LISTING_KINDS, limitsFor, type Limits, type ListingKind } from './pro-fields';

/** The caps each perk raises live in pro-fields.ts, which the forms import too. Re-exported so server code has one import. */
export {
  limitsFor,
  readLinks,
  freeLimits,
  proLimits,
  amount,
  money,
  planTotal,
  eventPhase,
  eventIsLive,
  EVENT_GRACE_MS,
  MAX_MANAGERS,
  annualSavingPct,
  MAX_LINK_LABEL,
  PRICING,
  type Limits,
  type ListingLink,
  type ListingKind,
  type Cycle,
  type EventPhase,
} from './pro-fields';

/**
 * YapBoard Pro entitlement.
 *
 * One rule, in one place. Everything that gates a perk asks `isPro(kind, listingId)` - nothing reads
 * `ProSubscription.status` or counts assignments for itself, because the moment two places decide
 * what "on Pro" means they disagree, and the way they disagree is that somebody paid and didn't get it.
 *
 * ## What a plan covers
 *
 * One plan covers **one server, one bot and one client**. Each extra slot bought on top covers one
 * more listing of **any** kind. So an owner with two extra slots could run three servers and one bot,
 * or one of each plus two more bots - the extras float.
 *
 * Pro is therefore held by a *listing*, not by an account: an owner with six servers and one plan has
 * one Pro server and five ordinary ones, and picks which. `ProAssignment` records the choice.
 *
 * ## When there are more assignments than slots
 *
 * A downgrade (or a card that finally failed) can leave an owner with more listings assigned than
 * they have slots for. Nothing is deleted. Slots are handed out in a fixed order - oldest assignment
 * first, each kind's base slot before the floating pool - so the answer is stable and explainable,
 * and the listings that lose out are the ones added most recently. Re-adding a slot restores them.
 *
 * ## Lapsing
 *
 * A failed payment does not take perks away. Stripe retries a failing invoice on its own dunning
 * schedule, during which the subscription sits at `past_due`; Pro survives that plus GRACE_DAYS past
 * the period already paid for, so a card that expired over a weekend doesn't blank somebody's banner.
 *
 * Once it really has lapsed, one rule decides what happens, and it is deliberately not "everything
 * switches off":
 *
 * - **A raised cap governs what you can add, not what you keep.** Ten tags and six thousand characters
 *   of description stay on the page and stay editable - `grandfather` below is what makes that true. What
 *   lapsing costs is the ability to go *further*: no eleventh tag, no six thousand and first character.
 * - **A Pro-only feature switches off, and is kept.** The header style, the screenshot gallery and the
 *   extra buttons stop being drawn, while the rows sit untouched in the database, so a renewal brings the
 *   page back exactly as it was. Nothing is ever deleted.
 *
 * The split is about what a lapse would otherwise destroy. Truncating somebody's description would throw
 * away writing they did; hiding a gallery costs them nothing they can't get back by paying again. The
 * renderers own the second half of that rule; this file only answers whether a listing is covered.
 */

/** How long past the paid-up period a failing subscription keeps its perks. */
export const GRACE_DAYS = 7;

/** Listings the base plan covers one of, before any extra slots. */
export const KINDS = LISTING_KINDS;
export const isListingKind = (v: unknown): v is ListingKind => (KINDS as readonly string[]).includes(v as string);

/**
 * Stripe statuses that are Pro outright. A scheduled cancellation stays `active` until it ends.
 *
 * `trialing` is honoured even though checkout never asks for a trial - the first period is charged up
 * front. It stays because a trial can still arrive from outside this code: a subscription set up by hand
 * in the Dashboard, or a comped period for somebody we've put right. Treating it as not-Pro would mean
 * taking the money (or the goodwill) and granting nothing.
 */
const LIVE = new Set(['active', 'trialing']);
/** Stripe is still retrying the invoice. Pro survives until the grace window runs out. */
const FAILING = new Set(['past_due', 'unpaid']);

export type Covered = { kind: ListingKind; listingId: string; via: 'base' | 'slot' };

export type PlanState = {
  /** There is a subscription worth honouring. Not the same as any particular listing being Pro. */
  active: boolean;
  subscriptionId: string | null;
  cycle: string | null;
  /** True while a payment is failing but the grace window hasn't run out. Worth telling them. */
  grace: boolean;
  until: Date | null;
  /** Set when they've cancelled and are running out the period they've paid for. */
  endingAt: Date | null;
  /** Extra slots bought on top of the base plan. */
  extraSlots: number;
  /** Total listings the plan can cover: one per kind, plus the floating extras. */
  capacity: number;
  /** The listings actually covered right now, in the order slots were handed out. */
  covered: Covered[];
  /** Assigned but over capacity: kept, not counting, waiting for a slot. */
  overflow: { kind: ListingKind; listingId: string }[];
  /** Slots paid for and not yet pointed at a listing. */
  spare: number;
};

const OFF: PlanState = {
  active: false,
  subscriptionId: null,
  cycle: null,
  grace: false,
  until: null,
  endingAt: null,
  extraSlots: 0,
  capacity: 0,
  covered: [],
  overflow: [],
  spare: 0,
};

/** Just enough of a subscription to hand its slots out. */
type Allocatable = { extraSlots: number; assignments: readonly { kind: string; listingId: string }[] };

/**
 * Hand a subscription's slots out: each kind's base slot first, then the floating pool, taking
 * assignments oldest-first. Callers pass them already sorted by `assignedAt`.
 *
 * Shared by `planState` (one owner, in full) and `proSet` (many owners, one board), so a card and the
 * billing screen can never disagree about which listing holds the slot.
 */
function allocate(sub: Allocatable) {
  const usedBase = new Set<ListingKind>();
  let usedFloating = 0;
  const covered: Covered[] = [];
  const overflow: PlanState['overflow'] = [];

  for (const a of sub.assignments) {
    if (!isListingKind(a.kind)) continue;
    if (!usedBase.has(a.kind)) {
      usedBase.add(a.kind);
      covered.push({ kind: a.kind, listingId: a.listingId, via: 'base' });
    } else if (usedFloating < sub.extraSlots) {
      usedFloating++;
      covered.push({ kind: a.kind, listingId: a.listingId, via: 'slot' });
    } else {
      overflow.push({ kind: a.kind, listingId: a.listingId });
    }
  }
  return { covered, overflow, usedBase, usedFloating };
}

/** Is this subscription worth honouring - live, or failing but still inside the grace window? */
function honoured(sub: { status: string; currentPeriodEnd: Date | null }, now: number) {
  if (LIVE.has(sub.status)) return { ok: true, grace: false };
  const end = sub.currentPeriodEnd?.getTime();
  // No period end recorded means the very first payment never succeeded, so there is nothing to be
  // generous with.
  const inGrace = end !== undefined && now < end + GRACE_DAYS * 86_400_000;
  return { ok: inGrace, grace: inGrace };
}

/**
 * Everything about an owner's plan, worked out once per request.
 *
 * `cache` is React's per-request memo, so the grid can ask for every card it draws without
 * re-querying. Note it memoises per argument, so this is one query per owner per request.
 */
export const planState = cache(async (userId: string | null | undefined): Promise<PlanState> => {
  if (!userId) return OFF;

  const subs = await db.proSubscription.findMany({
    where: { userId, status: { in: [...LIVE, ...FAILING] } },
    select: {
      id: true,
      status: true,
      cycle: true,
      currentPeriodEnd: true,
      cancelAt: true,
      extraSlots: true,
      assignments: { select: { kind: true, listingId: true }, orderBy: { assignedAt: 'asc' } },
    },
    orderBy: { currentPeriodEnd: 'desc' },
  });

  const now = Date.now();
  for (const sub of subs) {
    const { ok, grace } = honoured(sub, now);
    if (!ok) continue;

    const { covered, overflow, usedBase, usedFloating } = allocate(sub);

    return {
      active: true,
      subscriptionId: sub.id,
      cycle: sub.cycle,
      grace,
      until: sub.currentPeriodEnd,
      endingAt: sub.cancelAt,
      extraSlots: sub.extraSlots,
      capacity: KINDS.length + sub.extraSlots,
      covered,
      overflow,
      // Base slots for kinds they haven't used, plus floating slots not yet spent.
      spare: KINDS.length - usedBase.size + (sub.extraSlots - usedFloating),
    };
  }

  return OFF;
});

/** The gate. Everything that unlocks a perk on a listing goes through this. */
export async function isPro(kind: ListingKind, listingId: string, ownerId: string | null | undefined): Promise<boolean> {
  const plan = await planState(ownerId);
  return plan.covered.some((c) => c.kind === kind && c.listingId === listingId);
}

/**
 * Pro on a listing the caller already has in hand. Pass the row with its `ownerId` - which every
 * listing select already includes - so this doesn't become a second query per card.
 */
export const listingIsPro = (kind: ListingKind, listing: { id: string; ownerId: string } | null | undefined) =>
  listing ? isPro(kind, listing.id, listing.ownerId) : Promise.resolve(false);

/** Does this owner have a plan at all? For showing "Manage billing" rather than "Upgrade". */
export const hasPlan = async (userId: string | null | undefined) => (await planState(userId)).active;

/** Can this owner put one more listing under Pro without buying a slot? */
export async function canAssign(userId: string | null | undefined, kind: ListingKind): Promise<boolean> {
  const plan = await planState(userId);
  if (!plan.active) return false;
  // A kind whose base slot is free always fits, regardless of the floating pool.
  if (!plan.covered.some((c) => c.kind === kind && c.via === 'base')) return true;
  return plan.covered.filter((c) => c.via === 'slot').length < plan.extraSlots;
}

/**
 * Which of these listings are on Pro, in one go.
 *
 * A board draws two dozen cards from two dozen different owners, so asking `isPro` per card would be two
 * dozen queries. This is two, whatever the page size: find the subscriptions that touch these listings,
 * then load those subscriptions *in full*. The second half matters - a slot belongs to the oldest
 * assignment, and that may well be a listing which isn't on this page, so an assignment can't be judged
 * without its siblings.
 */
export async function proSet(kind: ListingKind, ids: readonly string[]): Promise<Set<string>> {
  const wanted = new Set(ids);
  if (!wanted.size) return new Set();

  const hits = await db.proAssignment.findMany({ where: { kind, listingId: { in: [...wanted] } }, select: { subscriptionId: true } });
  const subIds = [...new Set(hits.map((h) => h.subscriptionId))];
  if (!subIds.length) return new Set();

  const subs = await db.proSubscription.findMany({
    where: { id: { in: subIds }, status: { in: [...LIVE, ...FAILING] } },
    select: {
      status: true,
      currentPeriodEnd: true,
      extraSlots: true,
      assignments: { select: { kind: true, listingId: true }, orderBy: { assignedAt: 'asc' } },
    },
  });

  const now = Date.now();
  const out = new Set<string>();
  for (const sub of subs) {
    if (!honoured(sub, now).ok) continue;
    for (const c of allocate(sub).covered) {
      if (c.kind === kind && wanted.has(c.listingId)) out.add(c.listingId);
    }
  }
  return out;
}

/** The caps that apply to one listing right now. The forms and the renderers both go through this. */
export async function limitsOf(kind: ListingKind, listingId: string, ownerId: string | null | undefined): Promise<Limits> {
  return limitsFor(kind, await isPro(kind, listingId, ownerId));
}

/**
 * Raise a listing's caps to cover what it already holds.
 *
 * Without this, lapsing is a trap: an owner who wrote 6000 characters on Pro and then cancelled would be
 * told "Max 2000 characters" on every save, so fixing a typo would mean deleting two thirds of their
 * description first. Grandfathering means the honest thing instead - you can't add more, but you never
 * have to throw anything away, and a renewal picks up where it left off.
 *
 * Only the fields a free listing still edits need it. The Pro-only ones (theme, screenshots, links) are
 * dropped from the save entirely rather than validated, so they can't fail.
 */
export function grandfather(limits: Limits, held: { description: number; tags: number }): Limits {
  return { ...limits, description: Math.max(limits.description, held.description), tags: Math.max(limits.tags, held.tags) };
}

/**
 * Let go of the slot a listing was holding, because the listing is gone.
 *
 * `ProAssignment` can't carry a foreign key - one column points at three different tables - so nothing
 * in the database cleans this up. Without it a deleted listing keeps its slot forever: the owner is
 * billed for capacity they can't use, and `canAssign` tells them their plan is full while pointing at a
 * row that no longer exists. Every DELETE of a listing calls this.
 *
 * It deliberately does **not** change the bill. Dropping a paid slot is always an explicit choice
 * (PATCH /api/billing/slots), the same way taking a listing off Pro by hand is.
 */
export async function releaseSlot(kind: ListingKind, listingId: string): Promise<void> {
  await db.proAssignment.deleteMany({ where: { kind, listingId } });
}

/**
 * Every listing of this kind that a live plan currently covers.
 *
 * Unlike `proSet` this takes no ids: it answers "who is on Pro?" rather than "are these on Pro?", which
 * is what the staff review queue needs before it can order anything. It loads all honoured subscriptions,
 * which is the paying customer list - bounded by revenue, so small by definition - and never the listings
 * themselves.
 */
export async function proListingIds(kind: ListingKind): Promise<Set<string>> {
  const subs = await db.proSubscription.findMany({
    where: { status: { in: [...LIVE, ...FAILING] } },
    select: {
      status: true,
      currentPeriodEnd: true,
      extraSlots: true,
      assignments: { select: { kind: true, listingId: true }, orderBy: { assignedAt: 'asc' } },
    },
  });

  const now = Date.now();
  const out = new Set<string>();
  for (const sub of subs) {
    if (!honoured(sub, now).ok) continue;
    for (const c of allocate(sub).covered) if (c.kind === kind) out.add(c.listingId);
  }
  return out;
}

/**
 * The staff review order: Pro listings first, then oldest first within each group.
 *
 * Priority review is a real perk on the bot and client boards, which genuinely have a queue
 * (`@@index([status, createdAt])` - "oldest PENDING first"). It is also the only Pro perk that costs
 * somebody else something, since a free listing waits a little longer, so it is deliberately the only
 * one: it reorders a queue, and never a board people browse.
 *
 * Sorted here rather than in SQL because `ProAssignment` has no relation to the listing tables - one
 * column points at three of them - so Prisma has nothing to `orderBy`. A review backlog is small, and
 * only ids are read, so sorting in memory costs nothing and is exact.
 */
export async function reviewOrder(kind: ListingKind, rows: readonly { id: string; createdAt: Date }[]): Promise<string[]> {
  if (rows.length < 2) return rows.map((r) => r.id);
  const pro = await proListingIds(kind);
  return [...rows]
    .sort((a, b) => Number(pro.has(b.id)) - Number(pro.has(a.id)) || a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => r.id);
}
