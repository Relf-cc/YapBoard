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

/**
 * Minimal .env reader: this script runs outside Next, which is what normally loads them.
 *
 * The file is read first and the real environment overlaid on top, so passing variables on the command
 * line checks the account you named rather than silently the dev one in Site/.env. Same precedence as
 * scripts/setup-prices.mjs, which is how either script is pointed at live.
 */
function env() {
  const out = {};
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env is fine as long as the variables are already in the environment.
  }
  for (const [k, v] of Object.entries(process.env)) if (v) out[k] = v;
  return out;
}

const E = env();
if (!E.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set, so there is nothing to check against. Set it in Site/.env.');
  process.exit(2);
}

const { default: Stripe } = await import(join(root, 'node_modules', 'stripe', 'esm', 'stripe.esm.node.js')).catch(() => import('stripe'));
const stripe = new Stripe(E.STRIPE_SECRET_KEY);

// Must match PRICING in src/lib/pro-fields.ts, in cents. Plain literals so this script needs no bundler.
const EXPECTED = {
  currency: 'usd',
  base: { monthly: 299, annual: 2999 },
  slot: { monthly: 100, annual: 1000 },
};

const TARGETS = [
  { env: 'STRIPE_PRICE_PRO_MONTHLY', role: 'base', cents: EXPECTED.base.monthly, interval: 'month', cycle: 'monthly' },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', role: 'base', cents: EXPECTED.base.annual, interval: 'year', cycle: 'annual' },
  { env: 'STRIPE_PRICE_SLOT_MONTHLY', role: 'slot', cents: EXPECTED.slot.monthly, interval: 'month', cycle: 'monthly' },
  { env: 'STRIPE_PRICE_SLOT_ANNUAL', role: 'slot', cents: EXPECTED.slot.annual, interval: 'year', cycle: 'annual' },
];

const show = (cents) => '$' + (cents / 100).toFixed(2);

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
  const before = bad;

  if (!price.active) problem(`${name} is not active`);
  if (price.currency !== EXPECTED.currency) problem(`${name} is in ${price.currency}, the page says ${EXPECTED.currency}`);
  if (price.unit_amount !== t.cents) problem(`${name} charges ${price.unit_amount == null ? 'nothing fixed' : show(price.unit_amount)}, the page says ${show(t.cents)}`);
  if (price.recurring?.interval !== t.interval) problem(`${name} bills per ${price.recurring?.interval ?? 'nothing'}, expected per ${t.interval}`);
  if (price.recurring?.interval_count !== 1) problem(`${name} bills every ${price.recurring?.interval_count} ${t.interval}s, expected every one`);
  if (price.metadata?.yapboard_role !== t.role) problem(`${name} has yapboard_role="${price.metadata?.yapboard_role ?? ''}", expected "${t.role}"`);
  // Not fatal: the webhook falls back to the Price's interval when this is missing (src/lib/stripe.ts).
  if (price.metadata?.yapboard_cycle !== t.cycle) console.log(`  warn  ${name} has no yapboard_cycle="${t.cycle}"; the webhook will infer it from the interval`);
  if (!price.product?.tax_code) problem(`${name}: product "${price.product?.name ?? '?'}" has no tax_code, so Managed Payments will refuse checkout`);

  if (bad === before) console.log(`  ok    ${t.env}: ${EXPECTED.currency.toUpperCase()} ${show(price.unit_amount)}/${t.interval}, role=${price.metadata?.yapboard_role}`);
}

/**
 * The annual plan has to be worth buying. /pro quotes the saving as a rounded percentage computed from
 * these same numbers (`annualSavingPct`), so the figure can't disagree with itself - what can go wrong is
 * an annual price that saves nothing, or so little that rounding makes the claim bigger than the discount.
 * A percentage is used rather than "N months free" because at $2.99/$29.99 the saving is 1.97 months, and
 * rounding that to "two months free" would quote nine cents more off than is actually on offer.
 */
const yearOfMonths = EXPECTED.base.monthly * 12;
const savedPct = (1 - EXPECTED.base.annual / yearOfMonths) * 100;
if (EXPECTED.base.annual >= yearOfMonths) problem(`the annual plan costs ${show(EXPECTED.base.annual)}, which is no cheaper than ${show(yearOfMonths)} of monthly - /pro says it saves ${Math.round(savedPct)}%`);
else if (Math.round(savedPct) - savedPct > 0.5) problem(`/pro rounds the annual saving up to ${Math.round(savedPct)}%, but it is only ${savedPct.toFixed(2)}%`);
else console.log(`  ok    annual costs ${show(EXPECTED.base.annual)} against ${show(yearOfMonths)} monthly: saves ${savedPct.toFixed(2)}%, /pro says ${Math.round(savedPct)}%`);

console.log(bad ? `\n${bad} problem(s). /pro is quoting prices Stripe would not charge.` : '\nAll four prices match what /pro says.');
process.exit(bad ? 1 : 0);
