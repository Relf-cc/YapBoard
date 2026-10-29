// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * Checks that the prices written on /pro are the prices Stripe would actually charge.
 *
 * `PRICING` in src/lib/pro-fields.ts is display copy: the browser needs the numbers without a round trip
 * to Stripe, and a marketing page must not hang because an API is slow. The amounts that get charged are
 * the Stripe Prices named by STRIPE_PRICE_*. So there are two copies of every number, and this is what
 * stops them drifting - worth running after any price change, and before a deploy that touches billing.
 *
 * It also checks the two things about those Prices that Pro's own code depends on:
 *
 *   - `metadata.yapboard_role` is `base` or `slot`. The webhook counts slots by this, not by price id,
 *     because repricing means creating a *new* Price - matching on an env var's id would silently zero
 *     every subscriber's slots the day the id changed.
 *   - the Product has a `tax_code`. Managed Payments refuses a line item without one, and the way it
 *     refuses is a 400 at checkout, after the buyer has clicked.
 *
 *   node scripts/check-prices.mjs        (reads Site/.env)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Minimal .env reader: this script runs outside Next, which is what normally loads them. */
function env() {
  const out = { ...process.env };
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env is fine as long as the variables are already in the environment.
  }
  return out;
}

const E = env();
if (!E.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set, so there is nothing to check against. Set it in Site/.env.');
  process.exit(2);
}

const { default: Stripe } = await import(join(root, 'node_modules', 'stripe', 'esm', 'stripe.esm.node.js')).catch(() => import('stripe'));
const stripe = new Stripe(E.STRIPE_SECRET_KEY);

// Must match PRICING in src/lib/pro-fields.ts. Kept as plain literals so this script needs no bundler.
const EXPECTED = {
  currency: 'usd',
  base: { monthly: 4, annual: 40 },
  slot: { monthly: 1, annual: 10 },
};

const TARGETS = [
  { env: 'STRIPE_PRICE_PRO_MONTHLY', role: 'base', amount: EXPECTED.base.monthly, interval: 'month' },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', role: 'base', amount: EXPECTED.base.annual, interval: 'year' },
  { env: 'STRIPE_PRICE_SLOT_MONTHLY', role: 'slot', amount: EXPECTED.slot.monthly, interval: 'month' },
  { env: 'STRIPE_PRICE_SLOT_ANNUAL', role: 'slot', amount: EXPECTED.slot.annual, interval: 'year' },
];

let bad = 0;
const problem = (msg) => {
  bad++;
  console.log(`  FAIL  ${msg}`);
};

for (const t of TARGETS) {
  const id = E[t.env];
  if (!id) {
    problem(`${t.env} is not set`);
    continue;
  }

  let price;
  try {
    price = await stripe.prices.retrieve(id, { expand: ['product'] });
  } catch (e) {
    problem(`${t.env} (${id}) could not be read: ${e.message}`);
    continue;
  }

  const name = `${t.env} (${id})`;
  const major = price.unit_amount == null ? null : price.unit_amount / 100;

  if (!price.active) problem(`${name} is not active`);
  if (price.currency !== EXPECTED.currency) problem(`${name} is in ${price.currency}, the page says ${EXPECTED.currency}`);
  if (major !== t.amount) problem(`${name} charges ${major}, the page says ${t.amount}`);
  if (price.recurring?.interval !== t.interval) problem(`${name} bills per ${price.recurring?.interval ?? 'nothing'}, expected per ${t.interval}`);
  if (price.metadata?.yapboard_role !== t.role) problem(`${name} has yapboard_role="${price.metadata?.yapboard_role ?? ''}", expected "${t.role}"`);
  if (!price.product?.tax_code) problem(`${name}: product "${price.product?.name ?? '?'}" has no tax_code, so Managed Payments will refuse checkout`);

  if (!bad) console.log(`  ok    ${t.env}: ${EXPECTED.currency.toUpperCase()} ${major}/${t.interval}, role=${price.metadata?.yapboard_role}`);
}

// The slot price must divide evenly into the annual discount story, or the copy lies about the saving.
const monthsFree = (EXPECTED.base.monthly * 12 - EXPECTED.base.annual) / EXPECTED.base.monthly;
if (!Number.isInteger(monthsFree)) problem(`the annual saving is ${monthsFree} months, and /pro rounds it - pick an annual price that divides evenly`);

console.log(bad ? `\n${bad} problem(s). /pro is quoting prices Stripe would not charge.` : '\nAll four prices match what /pro says.');
process.exit(bad ? 1 : 0);
