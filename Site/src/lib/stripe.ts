// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import Stripe from 'stripe';
import { db } from './db';
import { env } from './env';
import type { SessionUser } from './session';

/**
 * The Stripe client, and the one place a Stripe Customer is tied to a YapBoard account.
 *
 * The API version is pinned rather than left to float: Stripe's object shapes change between
 * versions, and the webhook reads fields off those objects. Bumping it is a deliberate act -
 * re-read src/app/api/stripe/webhook/route.ts when you do.
 */
export const API_VERSION = '2026-09-30.endive' as const;

/**
 * One instance, reused. Next's dev server re-evaluates modules on every edit, so it's cached on
 * globalThis the same way the Prisma client is (src/lib/db.ts) - otherwise each reload leaks a
 * client and its keep-alive sockets.
 */
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe: Stripe =
  globalForStripe.stripe ??
  new Stripe(env.stripeSecret, {
    apiVersion: API_VERSION,
    // Named so YapBoard shows up as itself in the Stripe dashboard's request logs.
    appInfo: { name: 'YapBoard', url: 'https://yapboard.dev' },
    // Two tries, then give up and let the caller fail honestly rather than hanging a request.
    maxNetworkRetries: 2,
    timeout: 15_000,
  });

if (!env.isProd) globalForStripe.stripe = stripe;

/**
 * The Prices, by billing cycle.
 *
 * `base` covers one server, one bot and one client. `slot` is bought with a quantity and covers one
 * more listing of any kind. They are separate Stripe Products on purpose: an invoice line shows the
 * Product name, so sharing one would print "YapBoard Pro" twice and leave the buyer unable to tell
 * the base plan from the extras.
 *
 * Every item on one subscription has to share a billing interval, so a slot is always bought at the
 * same cycle as the base plan it hangs off.
 */
export const PRICES = {
  monthly: () => ({ base: env.stripePrices.monthly, slot: env.stripePrices.slotMonthly }),
  annual: () => ({ base: env.stripePrices.annual, slot: env.stripePrices.slotAnnual }),
} as const;

export type Cycle = keyof typeof PRICES;
export const isCycle = (v: unknown): v is Cycle => v === 'monthly' || v === 'annual';

/** Most extra slots one subscription may hold. A guard against a fat-fingered quantity, not a policy. */
export const MAX_EXTRA_SLOTS = 50;

/**
 * How many extra slots a Stripe subscription carries.
 *
 * Read from the slot line's quantity. Matched on the Price's `yapboard_role` metadata rather than on
 * an id from the environment, so a price change (you never edit a Price's amount - you make a new one)
 * doesn't silently start reporting zero slots for everyone already subscribed.
 */
export function extraSlotsOf(sub: Stripe.Subscription): number {
  let slots = 0;
  for (const item of sub.items.data) {
    if (item.price?.metadata?.yapboard_role === 'slot') slots += item.quantity ?? 0;
  }
  return slots;
}

/** The base line on a subscription: the one that says which plan and cycle they're on. */
export function baseItemOf(sub: Stripe.Subscription) {
  const items = sub.items.data;
  return items.find((i) => i.price?.metadata?.yapboard_role === 'base') ?? items.find((i) => i.price?.metadata?.yapboard_role !== 'slot') ?? items[0];
}

/**
 * The YapBoard account a Stripe event belongs to.
 *
 * Billing events are resolved through Stripe's own object graph to the Customer - the resource that
 * represents who is paying - and only then mapped to a local row. Deliberately *not* through
 * metadata on the session or subscription: metadata is set by whoever created the object and isn't
 * guaranteed to survive a plan change, a Dashboard edit or a Customer Portal action, whereas the
 * Customer link does.
 */
export async function userForCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  const id = typeof customer === 'string' ? customer : customer?.id;
  if (!id) return null;
  return db.user.findUnique({ where: { stripeCustomerId: id }, select: { id: true } });
}

/**
 * This account's Stripe Customer, made on first use.
 *
 * The id is written back to the User row straight away, so a second checkout reuses the same
 * Customer instead of making a duplicate - duplicates are what break `userForCustomer`, and they're
 * hard to untangle once invoices hang off both. The YapBoard user id goes in `metadata` purely so a
 * human reading the Stripe dashboard can tell who it is; nothing reads it back.
 */
export async function customerFor(user: SessionUser): Promise<string> {
  const row = await db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (row?.stripeCustomerId) return row.stripeCustomerId;

  const customer = await stripe.customers.create(
    {
      name: user.displayName || user.username,
      metadata: { yapboard_user_id: user.id, yapboard_username: user.username },
    },
    // Keyed on the account, so a double-clicked "Upgrade" can't create two Customers.
    { idempotencyKey: `yb-customer-${user.id}` },
  );

  // A race here (two tabs at once) would lose one Customer. updateMany with the guard means the
  // first write wins and the second re-reads, so both tabs end up on the same one.
  await db.user.updateMany({ where: { id: user.id, stripeCustomerId: null }, data: { stripeCustomerId: customer.id } });
  const after = await db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
  return after?.stripeCustomerId ?? customer.id;
}

/**
 * Eight random letters, appended to the checkout label. Stripe uses `integration_identifier` to
 * group sessions in the dashboard, and the suffix keeps separate rollouts of the same flow apart.
 */
export const INTEGRATION_ID = 'yapboard-pro-ktqwzmvb';
