// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { billingEnabled } from '@/lib/env';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { canAssign, isListingKind, planState, type ListingKind } from '@/lib/pro';
import { MAX_EXTRA_SLOTS, PRICES, stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * Which of an owner's listings are under their Pro plan, and how many slots they're paying for.
 *
 * A plan covers one server, one bot and one client; each extra slot covers one more listing of any
 * kind. So there are two different things an owner does here, and they are deliberately separate
 * requests: **assigning** a listing to a slot they already have (free, instant, reversible), and
 * **buying or dropping** slots (a quantity change on the Stripe subscription, which bills).
 *
 *   GET    - what's covered, what's spare, what's over capacity
 *   POST   - put a listing under the plan
 *   DELETE - take a listing out (the slot goes back to the pool; the plan is unchanged)
 *   PATCH  - change how many extra slots are paid for
 */

const target = z.object({
  kind: z.string().refine(isListingKind, 'Pick a server, bot or client'),
  listingId: z.string().trim().min(1).max(64),
});

/** The owner of one listing, whichever board it's on. Returns null when it isn't theirs to assign. */
async function ownedListing(kind: ListingKind, listingId: string, userId: string) {
  const select = { ownerId: true, status: true, name: true } as const;
  const row =
    kind === 'server'
      ? await db.server.findUnique({ where: { id: listingId }, select })
      : kind === 'bot'
        ? await db.botListing.findUnique({ where: { id: listingId }, select })
        : await db.clientListing.findUnique({ where: { id: listingId }, select });
  if (!row || row.ownerId !== userId) return null;
  return row;
}

export async function GET(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const plan = await planState(g.user.id);
  return json(plan);
}

export async function POST(req: NextRequest) {
  if (!billingEnabled()) return fail('Billing isn’t set up.', 503);
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`slots:${g.user.id}`, 60, 10 * 60_000)) return fail('Slow down a little.', 429);

  const parsed = target.safeParse(await readJson(req));
  if (!parsed.success) return fail('Pick a listing', 422);
  const kind = parsed.data.kind as ListingKind;
  const { listingId } = parsed.data;

  const plan = await planState(g.user.id);
  if (!plan.active || !plan.subscriptionId) return fail('You don’t have a YapBoard Pro plan yet.', 403, { needsPlan: true });

  const listing = await ownedListing(kind, listingId, g.user.id);
  if (!listing) return fail('That isn’t one of your listings.', 404);
  // A listing staff have removed can never come back, so it must never be something anyone pays for.
  if (listing.status === 'REMOVED') return fail('This listing was removed by YapBoard staff, so it can’t be put on Pro.', 403);

  const existing = await db.proAssignment.findUnique({ where: { kind_listingId: { kind, listingId } }, select: { subscriptionId: true } });
  if (existing) {
    return existing.subscriptionId === plan.subscriptionId
      ? json({ ok: true, alreadyAssigned: true, plan: await planState(g.user.id) })
      : fail('This listing is already on someone else’s Pro plan.', 409);
  }

  if (!(await canAssign(g.user.id, kind))) {
    return fail(`Your plan is full. Add an extra listing slot to cover this ${kind}.`, 409, { needsSlot: true, extraSlots: plan.extraSlots });
  }

  await db.proAssignment.create({ data: { subscriptionId: plan.subscriptionId, kind, listingId } });
  return json({ ok: true, plan: await planState(g.user.id) });
}

export async function DELETE(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;

  const parsed = target.safeParse(await readJson(req));
  if (!parsed.success) return fail('Pick a listing', 422);
  const kind = parsed.data.kind as ListingKind;
  const { listingId } = parsed.data;

  const plan = await planState(g.user.id);
  if (!plan.subscriptionId) return fail('You don’t have a YapBoard Pro plan.', 404);

  // Scoped to their own subscription, so this can't unassign somebody else's listing.
  const removed = await db.proAssignment.deleteMany({ where: { kind, listingId, subscriptionId: plan.subscriptionId } });
  if (!removed.count) return fail('That listing isn’t on your plan.', 404);

  /**
   * The slot goes back to the pool; they keep paying for it until they drop it with PATCH. Taking a
   * listing off Pro deliberately does not reduce the bill - that would make an accidental click cost
   * them their proration, and the slot is immediately reusable for another listing.
   */
  return json({ ok: true, plan: await planState(g.user.id) });
}

const quantity = z.object({ extraSlots: z.number().int().min(0).max(MAX_EXTRA_SLOTS) });

/**
 * Buy or drop extra listing slots: a quantity change on the live Stripe subscription.
 *
 * Stripe prorates, so adding a slot mid-month charges the remainder of the month and dropping one
 * credits it. The local `extraSlots` is **not** written here - the `customer.subscription.updated`
 * webhook does that, so there is exactly one writer and the site can't drift from Stripe if this
 * request dies after Stripe accepted it.
 */
export async function PATCH(req: NextRequest) {
  if (!billingEnabled()) return fail('Billing isn’t set up.', 503);
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`slotqty:${g.user.id}`, 20, 10 * 60_000)) return fail('Slow down a little.', 429);

  const parsed = quantity.safeParse(await readJson(req));
  if (!parsed.success) return fail(`Pick a number of extra listings, up to ${MAX_EXTRA_SLOTS}.`, 422);
  const want = parsed.data.extraSlots;

  const plan = await planState(g.user.id);
  if (!plan.active || !plan.subscriptionId) return fail('You don’t have a YapBoard Pro plan yet.', 403, { needsPlan: true });
  if (want === plan.extraSlots) return json({ ok: true, unchanged: true, plan });

  const sub = await stripe.subscriptions.retrieve(plan.subscriptionId);
  const slotPrice = PRICES[plan.cycle === 'annual' ? 'annual' : 'monthly']().slot;
  const line = sub.items.data.find((i) => i.price?.metadata?.yapboard_role === 'slot');

  await stripe.subscriptions.update(
    plan.subscriptionId,
    {
      items: line
        ? // Quantity 0 isn't allowed on an item, so dropping every slot removes the line instead.
          [want === 0 ? { id: line.id, deleted: true } : { id: line.id, quantity: want }]
        : [{ price: slotPrice, quantity: want }],
      proration_behavior: 'create_prorations',
    },
    // Keyed on the subscription and the target, so a double-clicked "+" can't buy two slots.
    { idempotencyKey: `yb-slots-${plan.subscriptionId}-${want}` },
  );

  // Read back through the webhook's view of the world rather than guessing; the webhook will have
  // been delivered by the time the owner reloads, and `extraSlots` here is whatever Stripe last told us.
  return json({ ok: true, requested: want, plan: await planState(g.user.id) });
}
