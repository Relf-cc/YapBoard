// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * What a listing may contain, free and on Pro.
 *
 * Every cap Pro raises lives here and nowhere else, because three places need the same number and two of
 * them run in the browser: the zod schema that accepts a save, the counter under the textarea that warns
 * before the save, and the page that renders what was saved. A cap that disagrees with its counter is a
 * form that lets you type 4000 characters and then refuses them.
 *
 * It sits beside client-fields.ts rather than in pro.ts for that same reason: pro.ts is `server-only` (it
 * reaches the database), and a form importing it would drag Prisma into the browser bundle. pro.ts
 * re-exports `limitsFor`, so server code can keep importing from one place.
 *
 * ## The lapse rule
 *
 * When a plan lapses, content over the free cap is **hidden, kept and restored on renewal** - never
 * deleted. So the renderer clamps to the free caps rather than trusting what is stored, and nothing here
 * ever shortens a row. Someone who writes 6000 characters, cancels, and comes back a year later gets
 * their 6000 characters back.
 */

import { MAX_TAGS, MAX_TAGS_PRO } from './tags';

/**
 * Co-managers a Pro listing may have, besides the owner.
 *
 * Three, because this exists to stop a listing dying with the one person who made it, not to run a staff
 * rota. A number this small also keeps the blast radius small if an owner adds somebody they shouldn't.
 */
export const MAX_MANAGERS = 3;

export const LISTING_KINDS = ['server', 'bot', 'client'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export type Limits = {
  tags: number;
  /** Characters in the description. */
  description: number;
  /** Screenshots on the listing page. */
  screenshots: number;
  /** Extra buttons beside Join/Add/Download, each a label and a link. */
  links: number;
  /** The lister picks the hero backdrop instead of taking the default. */
  themes: boolean;
  /** People besides the owner who may edit the listing and bump it. */
  managers: number;
  /** "What's on": the next thing happening, which hides itself once it's over. */
  events: boolean;
  /**
   * A second language, with its own summary and description, listed in that language's results too.
   *
   * Governs **editing only**. What's already written stays on the page and stays searchable in that
   * language after a lapse, because it is writing the owner did - the same side of the rule as their tags
   * and their description. The event above is the other way round: 80 characters that expire this week,
   * so nothing is lost by hiding them.
   */
  altLanguage: boolean;
};

/**
 * Free listings, as they have always been. Clients keep their screenshots and hero themes: those shipped
 * free, and taking them away to resell them is the one thing Pro must never do.
 */
const FREE: Record<ListingKind, Limits> = {
  server: { tags: MAX_TAGS, description: 2000, screenshots: 0, links: 0, themes: false, managers: 0, events: false, altLanguage: false },
  bot: { tags: MAX_TAGS, description: 2000, screenshots: 0, links: 0, themes: false, managers: 0, events: false, altLanguage: false },
  client: { tags: MAX_TAGS, description: 4000, screenshots: 6, links: 0, themes: true, managers: 0, events: false, altLanguage: false },
};

/**
 * On Pro. Servers and bots catch up to what a client listing could always do; everything gets the longer
 * description and the wider tag set.
 *
 * The boards are not equal yet. Some gaps are places with no column to write to rather than choices:
 * `BotListing` has nowhere to put screenshots or links, and `ClientListing` has nowhere to put links. A
 * client's perk is twice the screenshots instead, since six already shipped free and Pro must never take
 * away what was free.
 *
 * Two gaps *are* choices. "What's on" and the second language are servers only, because both describe a
 * place people go rather than software they install: a bot has no Friday night, and a client's second
 * language would be a translated changelog nobody asked for. Co-managers are on all three, because "the
 * person who listed it has left" happens on every board.
 */
const PRO: Record<ListingKind, Limits> = {
  server: { tags: MAX_TAGS_PRO, description: 6000, screenshots: 6, links: 3, themes: true, managers: MAX_MANAGERS, events: true, altLanguage: true },
  bot: { tags: MAX_TAGS_PRO, description: 6000, screenshots: 0, links: 0, themes: false, managers: MAX_MANAGERS, events: false, altLanguage: false },
  client: { tags: MAX_TAGS_PRO, description: 6000, screenshots: 12, links: 0, themes: true, managers: MAX_MANAGERS, events: false, altLanguage: false },
};

export const limitsFor = (kind: ListingKind, pro: boolean): Limits => (pro ? PRO : FREE)[kind];

/** For copy that compares the two, so the /pro page can't quote a number the code doesn't use. */
export const freeLimits = (kind: ListingKind) => FREE[kind];
export const proLimits = (kind: ListingKind) => PRO[kind];

/** A button the lister adds beside Join. Stored as a JSON array (SQLite has no array type). */
export type ListingLink = { label: string; url: string };

export const MAX_LINK_LABEL = 24;

/**
 * Links as stored, cleaned for display. Anything malformed is dropped rather than thrown: a listing page
 * must not 500 because a row predates a validation change.
 */
export function readLinks(raw: string | null | undefined, max: number): ListingLink[] {
  if (!raw || max <= 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is ListingLink => {
        if (!l || typeof l !== 'object') return false;
        const { label, url } = l as Record<string, unknown>;
        return typeof label === 'string' && !!label.trim() && typeof url === 'string' && /^https:\/\/\S+\.\S+/.test(url);
      })
      .map((l) => ({ label: l.label.trim().slice(0, MAX_LINK_LABEL), url: l.url }))
      .slice(0, max);
  } catch {
    return [];
  }
}

/**
 * What Pro costs, for the copy on /pro.
 *
 * These are display values. The amounts that actually get charged are the Stripe Prices named by
 * STRIPE_PRICE_* - Stripe is the only place money is decided, and a Price's amount can never be edited
 * (you create a new Price and point the env var at it). So these two have to be kept in step by hand,
 * and `node scripts/check-prices.mjs` is what checks they still agree.
 *
 * Amounts are in **cents**, the same unit as Stripe's `unit_amount`, so the two copies can be compared
 * without converting and so adding a slot to a plan is integer arithmetic. `$2.99 + $1` in floats is not
 * reliably `$3.99`; `299 + 100` always is. Nothing renders a raw number from here - everything goes
 * through `amount()` or `money()`, which is also where the currency symbol lives.
 */
export const PRICING = {
  currency: 'USD',
  symbol: '$',
  base: { monthly: 299, annual: 2999 },
  slot: { monthly: 100, annual: 1000 },
} as const;

export type Cycle = 'monthly' | 'annual';

/**
 * Cents as a price: "$2.99", or "$1" where the cents are zero.
 *
 * The trailing ".00" is dropped because "$1.00 a month" reads like a form field and "$1 a month" reads
 * like a price. Everything that shows money goes through here, so a currency change is one edit.
 */
export const amount = (cents: number) => `${PRICING.symbol}${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;

/** "$2.99/mo" or "$29.99/yr". Takes cents. */
export const money = (cents: number, cycle: Cycle) => `${amount(cents)}/${cycle === 'annual' ? 'yr' : 'mo'}`;

/** What a base plan plus `slots` extra listings comes to per period, **in cents**. Format with `amount()`. */
export const planTotal = (cycle: Cycle, slots: number) => PRICING.base[cycle] + PRICING.slot[cycle] * slots;

/**
 * How much the annual plan saves, as a whole percentage, for the copy on the cycle toggle.
 *
 * A percentage rather than "two months free": at these prices the annual plan is 1.97 months' worth off,
 * and rounding that to "2 months free" would quote a saving nine cents larger than the one on offer.
 * `scripts/check-prices.mjs` checks this number against the Prices Stripe would actually charge.
 */
export const annualSavingPct = () => Math.round((1 - PRICING.base.annual / (PRICING.base.monthly * 12)) * 100);

/**
 * How long after it starts a "what's on" event still counts as happening.
 *
 * Three hours, so a listing advertising an 8pm movie night still says so at 10pm, when somebody reading
 * the page could still turn up. Past that it takes itself off, because a listing showing last week's
 * event reads as abandoned - which is worse than showing nothing.
 */
export const EVENT_GRACE_MS = 3 * 60 * 60 * 1000;

export type EventPhase = 'upcoming' | 'on' | 'over';

/** Where an event sits relative to now. `null` for a listing with no event set. */
export function eventPhase(at: string | Date | null | undefined, now = Date.now()): EventPhase | null {
  if (!at) return null;
  const t = at instanceof Date ? at.getTime() : Date.parse(at);
  if (Number.isNaN(t)) return null;
  if (now < t) return 'upcoming';
  return now < t + EVENT_GRACE_MS ? 'on' : 'over';
}

/** True when an event is worth drawing: set, and not yet over. */
export const eventIsLive = (at: string | Date | null | undefined, now = Date.now()) => {
  const phase = eventPhase(at, now);
  return phase === 'upcoming' || phase === 'on';
};
