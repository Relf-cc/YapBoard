// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { cache } from 'react';
import { db } from './db';

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
 * Once it does lapse, Pro-only content is hidden, kept, and restored on renewal - never deleted.
 * That rule belongs to whatever renders the perk; this file only answers whether to render it.
 */

/** How long past the paid-up period a failing subscription keeps its perks. */
export const GRACE_DAYS = 7;

/** Listings the base plan covers one of, before any extra slots. */
export const KINDS = ['server', 'bot', 'client'] as const;
export type ListingKind = (typeof KINDS)[number];
export const isListingKind = (v: unknown): v is ListingKind => KINDS.includes(v as ListingKind);

/** Stripe statuses that are Pro outright. A scheduled cancellation stays `active` until it ends. */
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
    const live = LIVE.has(sub.status);
    const end = sub.currentPeriodEnd?.getTime();
    // Failing: honoured to the end of the paid period plus the grace window. No period end recorded
    // means the very first payment never succeeded, so there is nothing to be generous with.
    const inGrace = !live && end !== undefined && now < end + GRACE_DAYS * 86_400_000;
    if (!live && !inGrace) continue;

    // Hand slots out in assignment order: each kind's base slot first, then the floating pool.
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

    return {
      active: true,
      subscriptionId: sub.id,
      cycle: sub.cycle,
      grace: inGrace,
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
