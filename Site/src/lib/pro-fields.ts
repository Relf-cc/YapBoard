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
};

/**
 * Free listings, as they have always been. Clients keep their screenshots and hero themes: those shipped
 * free, and taking them away to resell them is the one thing Pro must never do.
 */
const FREE: Record<ListingKind, Limits> = {
  server: { tags: MAX_TAGS, description: 2000, screenshots: 0, links: 0, themes: false },
  bot: { tags: MAX_TAGS, description: 2000, screenshots: 0, links: 0, themes: false },
  client: { tags: MAX_TAGS, description: 4000, screenshots: 6, links: 0, themes: true },
};

/**
 * On Pro. Servers and bots catch up to what a client listing could always do; everything gets the longer
 * description and the wider tag set.
 *
 * The boards are not equal yet, and the gaps are places with no column to write to rather than choices:
 * `BotListing` has nowhere to put screenshots or links, and `ClientListing` has nowhere to put links. A
 * client's perk is twice the screenshots instead, since six already shipped free and Pro must never take
 * away what was free.
 */
const PRO: Record<ListingKind, Limits> = {
  server: { tags: MAX_TAGS_PRO, description: 6000, screenshots: 6, links: 3, themes: true },
  bot: { tags: MAX_TAGS_PRO, description: 6000, screenshots: 0, links: 0, themes: false },
  client: { tags: MAX_TAGS_PRO, description: 6000, screenshots: 12, links: 0, themes: true },
};

export const limitsFor = (kind: ListingKind, pro: boolean): Limits => (pro ? PRO : FREE)[kind];

/** For copy that compares the two, so the /pro page can't quote a number the code doesn't use. */
export const freeLimits = (kind: ListingKind) => FREE[kind];
export const proLimits = (kind: ListingKind) => PRO[kind];

/** The widest a field can ever be, for the `maxLength` on an input and the column it's stored in. */
export const maxEver = {
  tags: Math.max(...LISTING_KINDS.map((k) => PRO[k].tags)),
  description: Math.max(...LISTING_KINDS.map((k) => PRO[k].description)),
  screenshots: Math.max(...LISTING_KINDS.map((k) => PRO[k].screenshots)),
  links: Math.max(...LISTING_KINDS.map((k) => PRO[k].links)),
};

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
 * Amounts are whole units of `currency`, because every price here is a round number and showing
 * "$4.00/mo" where "$4/mo" will do is just noise.
 */
export const PRICING = {
  currency: 'USD',
  symbol: '$',
  base: { monthly: 4, annual: 40 },
  slot: { monthly: 1, annual: 10 },
} as const;

export type Cycle = 'monthly' | 'annual';

/** "$4/mo" or "$40/yr". */
export const money = (amount: number, cycle: Cycle) => `${PRICING.symbol}${amount}/${cycle === 'annual' ? 'yr' : 'mo'}`;

/** What a base plan plus `slots` extra listings comes to, per period. */
export const planTotal = (cycle: Cycle, slots: number) => PRICING.base[cycle] + PRICING.slot[cycle] * slots;

/** Two months free on the annual plan, as a round number of months, for the copy on the toggle. */
export const annualSaving = () => Math.round((PRICING.base.monthly * 12 - PRICING.base.annual) / PRICING.base.monthly);
