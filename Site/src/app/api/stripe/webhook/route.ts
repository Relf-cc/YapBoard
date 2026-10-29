// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { WITHDRAWAL_COUNTRIES } from '@/lib/region';
import { env } from '@/lib/env';
import { fail, json } from '@/lib/http';
import { baseItemOf, extraSlotsOf, stripe, userForCustomer } from '@/lib/stripe';

/** The Stripe SDK (and the crypto the signature check uses) needs Node, not the edge runtime. */
export const runtime = 'nodejs';
/** Never cached, never prerendered: every request is a distinct signed event. */
export const dynamic = 'force-dynamic';

/**
 * Stripe's webhook. The only part of the site that knows a subscription changed.
 *
 * This is the third authentication scheme in the API, and the only one that is neither a session nor
 * `INTERNAL_API_SECRET`: the request comes from Stripe, not from a browser or the bot, so it is
 * authenticated by the signature over the **raw** body. That is why it reads `req.text()` rather than
 * the `readJson` helper every other route uses - `readJson` parses, and a parsed-and-restringified
 * body no longer matches the signature. It also means `requireUser`/`sameOrigin` must not be used
 * here; there is no session and no origin to check.
 *
 * Note for deploys: `Caddyfile` blocks `/api/internal/*` from outside. This route is deliberately
 * **not** under `/internal`, because Stripe has to be able to reach it.
 *
 * The contract with Stripe: answer 2xx once the event is safely recorded, and non-2xx to be retried.
 * So a handler that throws returns 500 on purpose - Stripe will send it again.
 */
export async function POST(req: NextRequest) {
  if (!env.stripeWebhookSecret) return fail('Billing isn’t set up.', 503);

  const signature = req.headers.get('stripe-signature');
  if (!signature) return fail('Missing signature', 400);

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, env.stripeWebhookSecret);
  } catch (e) {
    // A bad signature is someone else posting here, or the wrong secret for this environment.
    // Never retryable, so answer 400 and don't let Stripe keep trying.
    console.error('[stripe] bad webhook signature:', (e as Error).message);
    return fail('Bad signature', 400);
  }

  /**
   * Stripe retries until it gets a 2xx and may deliver the same event more than once, so handling is
   * keyed on the event id. Claiming the row first means a duplicate arriving while the first is still
   * running is dropped rather than applied twice.
   */
  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2002') throw e;
    const seen = await db.stripeEvent.findUnique({ where: { id: event.id }, select: { handledAt: true } });
    // Already done. Say so cheerfully so Stripe stops.
    if (seen?.handledAt) return json({ received: true, duplicate: true });
    // Claimed but never finished - a previous attempt died. Fall through and try again.
  }

  try {
    await handle(event);
    await db.stripeEvent.update({ where: { id: event.id }, data: { handledAt: new Date(), error: null } });
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    console.error(`[stripe] ${event.type} (${event.id}) failed:`, message);
    await db.stripeEvent.update({ where: { id: event.id }, data: { error: message } }).catch(() => {});
    // 500 so Stripe retries. The claim row stays, and the branch above lets the retry through.
    return fail('Handler failed', 500);
  }

  return json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    /**
     * The buyer finished checkout. `customer.subscription.created` says the same thing, but this one
     * usually lands first, and it's what makes Pro already true when the success page redirects.
     * Both go through the same upsert, so whichever order they arrive in the result is the same.
     */
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription') break;
      const id = idOf(session.subscription);
      if (id) await syncSubscription(await stripe.subscriptions.retrieve(id));
      break;
    }

    // The lifecycle. `deleted` arrives with status 'canceled', so the same upsert covers it.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object);
      break;

    /** A renewal went through: re-sync so the period end moves forward. */
    case 'invoice.paid': {
      const id = subscriptionOf(event.data.object);
      if (id) await syncSubscription(await stripe.subscriptions.retrieve(id));
      break;
    }

    /**
     * A renewal failed. Stripe will retry on its own dunning schedule and the subscription goes
     * `past_due`, which `isPro` keeps alive through the grace window - so nothing is switched off
     * here. It is recorded because a card failing is the start of losing a paying customer.
     */
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const id = subscriptionOf(invoice);
      if (id) await syncSubscription(await stripe.subscriptions.retrieve(id));
      await alert({
        customer: invoice.customer,
        kind: 'payment_failed',
        stripeId: invoice.id ?? event.id,
        detail: `Invoice for ${money(invoice.amount_due, invoice.currency)} failed${invoice.next_payment_attempt ? `; Stripe retries ${new Date(invoice.next_payment_attempt * 1000).toISOString()}` : ' and will not be retried'}.`,
      });
      break;
    }

    /**
     * The risk side. By the time one of these arrives the money is already gone or already at risk,
     * so these are recorded for a person to look at rather than acted on automatically - cancelling
     * someone's Pro over a single chargeback is a decision, not a rule.
     */
    case 'charge.dispute.created': {
      const dispute = event.data.object;
      await alert({
        customer: typeof dispute.charge === 'string' ? (await stripe.charges.retrieve(dispute.charge)).customer : dispute.charge.customer,
        kind: 'dispute',
        stripeId: dispute.id,
        detail: `Disputed ${money(dispute.amount, dispute.currency)}: ${dispute.reason}. Evidence due ${dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : 'unknown'}.`,
      });
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      await alert({
        customer: charge.customer,
        kind: 'refund',
        stripeId: charge.id,
        detail: `Refunded ${money(charge.amount_refunded, charge.currency)} of ${money(charge.amount, charge.currency)}.`,
      });
      break;
    }

    case 'radar.early_fraud_warning.created': {
      const warning = event.data.object;
      await alert({
        customer: typeof warning.charge === 'string' ? (await stripe.charges.retrieve(warning.charge)).customer : warning.charge.customer,
        kind: 'fraud_warning',
        stripeId: warning.id,
        detail: `Early fraud warning (${warning.fraud_type}). Refunding before a dispute avoids the chargeback fee.`,
      });
      break;
    }

    default:
      // Subscribed to more than we act on, or Stripe added an event type. Recorded, not handled.
      break;
  }
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id) ?? null;

/**
 * The Subscription an invoice came from.
 *
 * On this API version an Invoice has no top-level `subscription`; it hangs off
 * `parent.subscription_details`, which is also null for a one-off invoice that has nothing to do
 * with Pro. Resolved through the object graph rather than through metadata, so a plan change or a
 * Customer Portal edit can't break the link.
 */
function subscriptionOf(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

/**
 * Write what Stripe says about a subscription into the local row.
 *
 * Stripe stays the source of truth; this is a cache so that drawing a Pro badge doesn't cost an API
 * call. Status is stored verbatim and interpreted in one place (src/lib/pro.ts).
 */
async function syncSubscription(sub: Stripe.Subscription) {
  const user = await userForCustomer(sub.customer);
  if (!user) {
    // A subscription with no matching account: made in the Dashboard by hand, or against a Customer
    // whose account was deleted. Worth a person's attention, and not something to invent a user for.
    await alert({ customer: sub.customer, kind: 'payment_failed', stripeId: sub.id, detail: `Subscription ${sub.id} (${sub.status}) has no matching YapBoard account.` });
    return;
  }

  // The base line says which plan and cycle; the slot line's quantity says how many extra listings.
  const item = baseItemOf(sub);
  const price = item?.price;
  // `current_period_end` lives on the subscription item on this API version, not on the subscription.
  const periodEnd = item?.current_period_end ?? null;
  const cycle = price?.metadata?.yapboard_cycle || (price?.recurring?.interval === 'year' ? 'annual' : 'monthly');

  const data = {
    userId: user.id,
    status: sub.status,
    priceId: price?.id ?? '',
    cycle,
    extraSlots: extraSlotsOf(sub),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    // `cancel_at` is set when they've scheduled a cancellation; Pro runs to the end of the period.
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  };

  await db.proSubscription.upsert({ where: { id: sub.id }, create: { id: sub.id, ...data }, update: data });

  await checkWithdrawalConsent(sub, user.id);
}

/**
 * Notice a UK or EEA customer who is being charged without a cancellation-right waiver on file.
 *
 * The checkbox on /pro and the guard in /api/billing/checkout are what stop this happening. This is the
 * backstop for the ways round them: a subscription created by hand in the Stripe Dashboard, one made
 * before the checkbox existed, or a buyer whose country looked like Ohio on the way in and like Ireland
 * on the card. None of those are errors in themselves - they just mean the 14-day right still stands,
 * and somebody should know that before refusing a refund.
 *
 * Only ever records an alert. It never blocks a payment: the money has already moved by the time this
 * runs, and a webhook that throws is a webhook Stripe retries forever.
 */
async function checkWithdrawalConsent(sub: Stripe.Subscription, userId: string) {
  if (sub.metadata?.yapboard_waiver) return;

  // Where Stripe thinks they are, which is the stronger signal: it comes off the card and the billing
  // address rather than off an IP.
  const customer = typeof sub.customer === 'string' ? await stripe.customers.retrieve(sub.customer).catch(() => null) : sub.customer;
  const country = (customer && !customer.deleted ? customer.address?.country : null) || sub.metadata?.yapboard_country || '';
  if (!country || !WITHDRAWAL_COUNTRIES.has(country.toUpperCase())) return;

  // Our own record, in case the metadata was lost rather than never set.
  const consent = await db.billingConsent.findFirst({ where: { userId, kind: 'withdrawal_waiver' }, select: { id: true } });
  if (consent) return;

  const existing = await db.billingAlert.findFirst({ where: { stripeId: sub.id, kind: 'missing_waiver', resolvedAt: null }, select: { id: true } });
  if (existing) return;

  await db.billingAlert.create({
    data: {
      userId,
      kind: 'missing_waiver',
      stripeId: sub.id,
      detail: `Customer appears to be in ${country.toUpperCase()} but has no cancellation-right waiver on file, so their 14-day right to cancel still stands. Don't refuse a refund on this one without checking.`,
    },
  });
}

/** Record something a person should look at. Never throws the request away if the lookup fails. */
async function alert(a: { customer: string | Stripe.Customer | Stripe.DeletedCustomer | null; kind: string; stripeId: string; detail: string }) {
  const user = await userForCustomer(a.customer);
  await db.billingAlert.create({ data: { userId: user?.id ?? null, kind: a.kind, stripeId: a.stripeId, detail: a.detail } });
}

const money = (amount: number | null | undefined, currency: string) => `${((amount ?? 0) / 100).toFixed(2)} ${currency.toUpperCase()}`;
