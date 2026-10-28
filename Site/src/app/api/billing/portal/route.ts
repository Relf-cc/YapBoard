// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { billingEnabled, env } from '@/lib/env';
import { fail, json, rateLimit, requireUser } from '@/lib/http';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * Sends an owner to Stripe's Customer Portal.
 *
 * Changing cycle, updating a card, reading invoices and cancelling all live there rather than in
 * YapBoard. That's deliberate: every one of those screens is a place to get card handling, dunning
 * and proration wrong, and none of them is a thing YapBoard does better by owning it. The webhook
 * hears about whatever they change, so the site doesn't need to be told.
 */
export async function POST(req: NextRequest) {
  if (!billingEnabled()) return fail('Billing isn’t set up.', 503);

  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`portal:${g.user.id}`, 20, 10 * 60_000)) return fail('Slow down a little.', 429);

  const row = await db.user.findUnique({ where: { id: g.user.id }, select: { stripeCustomerId: true } });
  // No Customer means they have never started a checkout, so there is nothing to manage.
  if (!row?.stripeCustomerId) return fail('You don’t have a YapBoard Pro subscription yet.', 404);

  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${env.siteUrl}/dashboard`,
  });

  return json({ url: session.url });
}
