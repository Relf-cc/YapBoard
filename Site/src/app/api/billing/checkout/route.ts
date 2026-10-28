// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { billingEnabled, env } from '@/lib/env';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { planState } from '@/lib/pro';
import { customerFor, INTEGRATION_ID, isCycle, MAX_EXTRA_SLOTS, PRICES, stripe } from '@/lib/stripe';

/** The Stripe SDK needs Node, not the edge runtime. */
export const runtime = 'nodejs';

const schema = z.object({
  cycle: z.string().refine(isCycle, 'Pick monthly or annual'),
  /** Extra listings beyond the one server, one bot and one client the base plan covers. */
  extraSlots: z.number().int().min(0).max(MAX_EXTRA_SLOTS).optional(),
});

/**
 * Starts a Stripe Checkout Session for YapBoard Pro and hands back the URL to send them to.
 *
 * Checkout rather than a payment form of our own: it handles the card, 3-D Secure, the trial, the
 * tax (once registrations exist - see the note in the Pro plan), and every payment method enabled in
 * the dashboard, none of which is work worth repeating here.
 */
export async function POST(req: NextRequest) {
  if (!billingEnabled()) return fail('Pro isn’t on sale yet.', 503);

  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`checkout:${g.user.id}`, 10, 10 * 60_000)) return fail('Slow down a little. Try again in a few minutes.', 429);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Pick a billing cycle', 422);
  const { cycle } = parsed.data;
  const extraSlots = parsed.data.extraSlots ?? 0;

  /**
   * Already paying: changing the plan is the Portal's job, not a second subscription. Buying more
   * slots once you're on Pro is a quantity change on the existing subscription, which is why there
   * is no "add slots" checkout - see /api/billing/slots and the Portal.
   */
  const plan = await planState(g.user.id);
  if (plan.active && !plan.grace) return fail('You’re already on Pro. Use "Manage billing" to change your plan or add listings.', 409, { alreadyPro: true });

  const customer = await customerFor(g.user);
  const prices = PRICES[cycle]();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    // No `payment_method_types`: leaving it out lets Stripe offer whatever is enabled in the
    // dashboard and relevant to the buyer, which is strictly better for conversion than pinning card.
    // Two lines, so the invoice reads "YapBoard Pro" and "YapBoard Pro extra listing x2".
    line_items: [{ price: prices.base, quantity: 1 }, ...(extraSlots > 0 ? [{ price: prices.slot, quantity: extraSlots }] : [])],
    subscription_data: {
      trial_period_days: 14,
      metadata: { yapboard_user_id: g.user.id, yapboard_cycle: cycle },
      // A trial that can't charge at the end should end, not silently lapse into an unpaid listing.
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    },
    // Yapin' doesn't give us an email address, so Checkout collects one. It's also where the receipt goes.
    customer_update: { name: 'auto', address: 'auto' },
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    // Groups these sessions in the Stripe dashboard so flows can be compared.
    integration_identifier: INTEGRATION_ID,
    client_reference_id: g.user.id,
    success_url: `${env.siteUrl}/dashboard?pro=welcome`,
    cancel_url: `${env.siteUrl}/pro`,
  });

  if (!session.url) return fail('Couldn’t start checkout. Try again in a minute.', 502);
  return json({ url: session.url });
}
