// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * Brings a Stripe account up to the Products and Prices YapBoard Pro needs, in either mode.
 *
 * `check-prices.mjs` tells you what is wrong; this fixes it. The two share one definition of what is
 * right - the amounts below must match PRICING in src/lib/pro-fields.ts, in cents.
 *
 * What it guarantees, and why each one matters:
 *
 *   - Two Products, "YapBoard Pro" and "YapBoard Pro extra listing". Separate because an invoice line
 *     shows the Product name, so one shared Product prints "YapBoard Pro" twice and the buyer can't tell
 *     the base plan from the extras.
 *   - A `tax_code` on both. Managed Payments refuses a line item without one, and the way it refuses is
 *     a 400 at checkout, after the buyer has clicked.
 *   - `metadata.yapboard_role` = base | slot on every Price. The webhook finds the base line and counts
 *     extra slots by this field alone (src/lib/stripe.ts), never by an id from the environment - because
 *     repricing means creating a *new* Price, and matching on an env var's id would silently zero every
 *     subscriber's slots the day that id changed.
 *   - The right amount on each of the four Prices. A Price's amount can never be edited, so a wrong one
 *     is replaced: a new Price is created, the lookup key moves to it, and the old one is archived.
 *     Archiving does not move anyone already subscribed to it - that is a migration, and a decision.
 *
 * Everything else about an existing Price is left alone, and metadata is patched in place rather than
 * replaced, so this is safe to run against an account that is already half set up.
 *
 *   node scripts/setup-prices.mjs              # says what it would do, changes nothing
 *   node scripts/setup-prices.mjs --apply      # does it
 *
 * The key comes from STRIPE_SECRET_KEY (the environment, or Site/.env). A live key additionally needs
 * --live, so that a shell with production variables loaded can't quietly reprice the real account:
 *
 *   node scripts/setup-prices.mjs --apply --live
 *
 * Afterwards it prints the four STRIPE_PRICE_* lines for that mode. Put them wherever that mode's
 * environment lives - never live price ids in the .env a dev machine uses with a test key.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const apply = process.argv.includes('--apply');
const liveOk = process.argv.includes('--live');

/**
 * Minimal .env reader: this script runs outside Next, which is what normally loads them.
 *
 * The file is read first and the real environment overlaid on top, so `STRIPE_SECRET_KEY=… node
 * scripts/setup-prices.mjs` points at the account you named rather than silently at the dev one in
 * Site/.env. That is the whole mechanism for running this against live, so the precedence matters.
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
const key = E.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. Put it in Site/.env or the environment.');
  process.exit(2);
}

const live = /_live_/.test(key);
if (live && !liveOk) {
  console.error('That is a live key. Re-run with --live if you really mean to change the live account.');
  process.exit(2);
}

/** Must match PRICING in src/lib/pro-fields.ts, in cents. */
const EXPECTED = {
  currency: 'usd',
  base: { monthly: 299, annual: 2999 },
  slot: { monthly: 100, annual: 1000 },
};

/** Software as a service. Both Products need one or Managed Payments refuses the line item. */
const TAX_CODE = 'txcd_10103000';

const PRODUCTS = {
  base: {
    name: 'YapBoard Pro',
    description:
      'Pro on one server, one bot and one client: longer descriptions, more tags, screenshots, hero themes, co-managers, events, a second language and priority review.',
    features: [
      'Covers one server, one bot and one client',
      '6,000-character descriptions (up from 2,000)',
      'The wider Pro tag set',
      'Up to 6 screenshots on a server listing',
      'Up to 12 screenshots on a client listing',
      'Pick your hero theme',
      '3 extra buttons beside Join',
      'Up to 3 co-managers per listing',
      "“What’s on” - your next event, on the card",
      'A second language, listed in that language’s results',
      'Priority review for bot and client listings',
      'Cancel any time',
    ],
  },
  slot: {
    name: 'YapBoard Pro extra listing',
    description: 'One more listing of any kind under your Pro plan - another server, bot or client.',
    features: ['One more server, bot or client on Pro', 'Floats across boards - use it wherever you need it', 'Add or drop any time; charged pro rata'],
  },
};

const TARGETS = [
  { env: 'STRIPE_PRICE_PRO_MONTHLY', role: 'base', cycle: 'monthly', interval: 'month', cents: EXPECTED.base.monthly, lookup: 'yapboard_pro_monthly' },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', role: 'base', cycle: 'annual', interval: 'year', cents: EXPECTED.base.annual, lookup: 'yapboard_pro_annual' },
  { env: 'STRIPE_PRICE_SLOT_MONTHLY', role: 'slot', cycle: 'monthly', interval: 'month', cents: EXPECTED.slot.monthly, lookup: 'yapboard_slot_monthly' },
  { env: 'STRIPE_PRICE_SLOT_ANNUAL', role: 'slot', cycle: 'annual', interval: 'year', cents: EXPECTED.slot.annual, lookup: 'yapboard_slot_annual' },
];

const { default: Stripe } = await import(join(root, 'node_modules', 'stripe', 'esm', 'stripe.esm.node.js')).catch(() => import('stripe'));
const stripe = new Stripe(key);

const show = (cents) => '$' + (cents / 100).toFixed(2);
const act = (msg) => console.log(`  ${apply ? 'done' : 'would'}  ${msg}`);
const kept = (msg) => console.log(`  ok    ${msg}`);

console.log(`${live ? 'LIVE' : 'test'} mode, ${apply ? 'applying changes' : 'dry run - nothing will be changed'}\n`);

/**
 * The Product for a role, found rather than assumed.
 *
 * Looked up by name among active Products, because the ids differ per account and per mode and this has
 * to work against an account somebody already made one of these by hand in.
 */
async function productFor(role) {
  const want = PRODUCTS[role];
  const existing = (await stripe.products.list({ active: true, limit: 100 })).data.find((p) => p.name === want.name);

  if (!existing) {
    if (!apply) {
      act(`create product "${want.name}" (tax_code ${TAX_CODE})`);
      return null;
    }
    const made = await stripe.products.create(
      { name: want.name, description: want.description, tax_code: TAX_CODE, marketing_features: want.features.map((name) => ({ name })) },
      { idempotencyKey: `yb-product-${role}-${live ? 'live' : 'test'}` },
    );
    act(`created product ${made.id} "${made.name}" (tax_code ${made.tax_code})`);
    return made;
  }

  // Only ever adds what's missing. An edited description is somebody's choice, not drift to correct.
  const patch = {};
  if (!existing.tax_code) patch.tax_code = TAX_CODE;
  if (!existing.description) patch.description = want.description;
  if (!existing.marketing_features?.length) patch.marketing_features = want.features.map((name) => ({ name }));

  if (!Object.keys(patch).length) {
    kept(`product ${existing.id} "${existing.name}" is set up`);
    return existing;
  }
  if (!apply) {
    act(`update product ${existing.id} "${existing.name}": ${Object.keys(patch).join(', ')}`);
    return existing;
  }
  const updated = await stripe.products.update(existing.id, patch);
  act(`updated product ${updated.id} "${updated.name}": ${Object.keys(patch).join(', ')}`);
  return updated;
}

const products = { base: await productFor('base'), slot: await productFor('slot') };
console.log('');

const ids = {};
for (const t of TARGETS) {
  const product = products[t.role];
  if (!product) {
    // Dry run with no product yet: there is nothing to compare a price against.
    act(`create ${show(t.cents)}/${t.interval} price (role=${t.role}, lookup ${t.lookup}) once the product exists`);
    continue;
  }

  const prices = (await stripe.prices.list({ product: product.id, active: true, limit: 100 })).data;
  const match = prices.find((p) => p.recurring?.interval === t.interval && p.recurring?.interval_count === 1 && p.currency === EXPECTED.currency);

  // Right amount already: leave the Price alone and only make sure the metadata the webhook reads is there.
  if (match && match.unit_amount === t.cents) {
    ids[t.env] = match.id;
    const needs = match.metadata?.yapboard_role !== t.role || match.metadata?.yapboard_cycle !== t.cycle;
    if (!needs) {
      kept(`${t.env}: ${match.id} ${show(match.unit_amount)}/${t.interval}, role=${t.role}`);
      continue;
    }
    if (!apply) {
      act(`tag ${match.id} with yapboard_role=${t.role}, yapboard_cycle=${t.cycle}`);
      continue;
    }
    // Patched, not replaced: metadata set elsewhere on this Price is left in place.
    const tagged = await stripe.prices.update(match.id, { metadata: { ...match.metadata, yapboard_role: t.role, yapboard_cycle: t.cycle } });
    act(`tagged ${tagged.id} role=${t.role} cycle=${t.cycle}`);
    continue;
  }

  // Wrong amount, or no price at this interval at all. An amount can't be edited, so make a new one.
  if (!apply) {
    act(
      match
        ? `replace ${match.id} (${show(match.unit_amount)}/${t.interval}) with a new ${show(t.cents)}/${t.interval} price, move lookup key "${t.lookup}" to it, archive the old one`
        : `create ${show(t.cents)}/${t.interval} price on ${product.id} (role=${t.role}, lookup ${t.lookup})`,
    );
    continue;
  }

  const made = await stripe.prices.create(
    {
      product: product.id,
      currency: EXPECTED.currency,
      unit_amount: t.cents,
      recurring: { interval: t.interval },
      lookup_key: t.lookup,
      transfer_lookup_key: true,
      metadata: { yapboard_role: t.role, yapboard_cycle: t.cycle },
    },
    { idempotencyKey: `yb-price-${live ? 'live' : 'test'}-${t.lookup}-${t.cents}` },
  );
  ids[t.env] = made.id;
  act(`created ${made.id} ${show(t.cents)}/${t.interval} role=${t.role} lookup=${t.lookup}`);

  if (match) {
    // Archived, not deleted, and nobody already billed on it is moved. That would be a migration.
    await stripe.prices.update(match.id, { active: false });
    act(`archived ${match.id} (${show(match.unit_amount)}/${t.interval}) - existing subscribers stay on it until migrated`);
  }
}

if (!apply) {
  console.log('\nDry run. Re-run with --apply to make these changes.');
  process.exit(0);
}

console.log(`\n--- ${live ? 'production' : 'test'} environment ---`);
for (const t of TARGETS) console.log(`${t.env}="${ids[t.env] ?? 'MISSING'}"`);
console.log(`\nThen: node scripts/check-prices.mjs`);
