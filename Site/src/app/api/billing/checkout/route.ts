// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { billingEnabled, env } from '@/lib/env';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { db } from '@/lib/db';
import { planState } from '@/lib/pro';
import { buyerCountry, needsWithdrawalWaiver, WAIVER_VERSION } from '@/lib/region';
import { customerFor, INTEGRATION_ID, isCycle, MAX_EXTRA_SLOTS, PRICES, stripe } from '@/lib/stripe';

/** The Stripe SDK needs Node, not the edge runtime. */
export const runtime = 'nodejs';

const schema = z.object({
  cycle: z.string().refine(isCycle, 'Pick monthly or annual'),
  /** Extra listings beyond the one server, one bot and one client the base plan covers. */
  extraSlots: z.number().int().min(0).max(MAX_EXTRA_SLOTS).optional(),
  /**
   * The buyer ticked the box asking for Pro to start immediately, giving up their 14-day right to
   * cancel each period once it's been supplied (src/lib/region.ts). Required for buyers in the UK and
   * the EEA, and for anyone whose country we can't establish.
   */
  waiveWithdrawal: z.boolean().optional(),
});

/**
 * Starts a Stripe Checkout Session for YapBoard Pro and hands back the URL to send them to.
 *
 * Checkout rather than a payment form of our own: it handles the card, 3-D Secure, the tax (once
 * registrations exist - see the note in the Pro plan), and every payment method enabled in the
 * dashboard, none of which is work worth repeating here.
 *
 * There is **no free trial**: the first period is charged at checkout and Pro starts there and then.
 * That is why the cancellation-right waiver below is not a formality - a UK or EEA consumer is paying
 * for a service that begins immediately, which is exactly the case the law wants asked about.
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

  /**
   * Consumers in the UK and the EEA have 14 days to cancel. They can ask for the service to begin
   * immediately and give that up, but only expressly - so if we believe they're in one of those
   * countries, the checkbox is not optional and this refuses to take their money without it.
   */
  const country = buyerCountry(req.headers);
  if (needsWithdrawalWaiver(req.headers) && !parsed.data.waiveWithdrawal) {
    return fail('Tick the box to confirm you want Pro to start straight away.', 422, { needsWaiver: true, country });
  }

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
      metadata: {
        yapboard_user_id: g.user.id,
        yapboard_cycle: cycle,
        // Stored twice on purpose: this copy survives even if our own row is lost, and the
        // webhook reads it to notice an EEA customer who somehow has no consent on file.
        ...(parsed.data.waiveWithdrawal ? { yapboard_waiver: WAIVER_VERSION } : {}),
        yapboard_country: country ?? '',
      },
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

  /**
   * The evidence, written now rather than when the webhook lands: what matters is that they agreed
   * before being charged, and this is the only moment that proves it. Recorded for every buyer who
   * ticked it, not just the ones we required it of, since a US buyer's tick is still a fact about
   * what was on their screen.
   */
  if (parsed.data.waiveWithdrawal) {
    await db.billingConsent
      .create({ data: { userId: g.user.id, kind: 'withdrawal_waiver', version: WAIVER_VERSION, country: country ?? '', sessionId: session.id } })
      // A lost consent row must not lose them the checkout they've just paid for; the Stripe metadata
      // carries the same fact, and the webhook raises an alert if neither is there.
      .catch(() => {});
  }

  return json({ url: session.url });
}
