// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';

const trim = (s: string) => s.replace(/\/$/, '');
const site = trim(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');

/**
 * Where a service that gets its own host in production actually lives.
 *
 * Its own variable when one is set, otherwise worked out from the site: `portal.yapboard.dev` in
 * production, and the site's own `/portal` in development, where there are no subdomains to point at.
 * The same rule `apiRoot()` uses for api.<host> (src/lib/platform.ts), for the same reason - an unset
 * variable in production used to leave every link pointing at `http://localhost:3000`, which is a
 * dead link for everyone but the person who deployed it, and looks like the site is broken.
 *
 * Always absolute, because `safeNext` and the same-origin check both do `new URL(...)` on these.
 */
function serviceUrl(name: string, explicit: string | undefined): string {
  if (explicit) return trim(explicit);
  try {
    const u = new URL(site);
    if (/^(localhost|127\.|\[?::1)/.test(u.hostname)) return `${site}/${name}`;
    return `${u.protocol}//${name}.${u.hostname.replace(/^www\./, '')}`;
  } catch {
    return `${site}/${name}`;
  }
}

export const env = {
  siteUrl: site,
  portalUrl: serviceUrl('portal', process.env.PORTAL_URL),
  /** The developer platform (src/lib/platform.ts), on its own host in production. */
  platformUrl: serviceUrl('platform', process.env.PLATFORM_URL),
  /**
   * The API's own host: api.yapboard.dev. Only the partner API's docs and copy buttons read it
   * (src/lib/platform.ts apiRoot), since those are the URLs somebody else's bot is pointed at.
   * Blank falls back to api.<site host>, or the site's own /api in dev.
   */
  apiUrl: (process.env.API_URL || '').replace(/\/$/, ''),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  clientId: process.env.YAPIN_CLIENT_ID || '',
  clientSecret: process.env.YAPIN_CLIENT_SECRET || '',
  botToken: process.env.YAPPER_BOT_TOKEN || '',
  internalSecret: process.env.INTERNAL_API_SECRET || '',
  /** Optional. Only raises GitHub's rate limit for reading client releases (src/lib/github.ts); nothing is written. */
  githubToken: process.env.GITHUB_TOKEN || '',
  staffIds: (process.env.STAFF_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  /**
   * The one account that owns YapBoard, for the badge beside their name.
   *
   * A setting rather than a constant in the source, because "who owns this" is deployment truth, not a
   * fact about the code - and a hard-coded id is the kind of thing that outlives the person it names.
   * Falls back to the first STAFF_IDS entry, which is almost always the same account, so a deployment
   * that never sets it still gets this right instead of silently getting it wrong.
   */
  ownerId: (process.env.OWNER_ID || '').trim() || (process.env.STAFF_IDS || '').split(',')[0]?.trim() || '',
  isProd: process.env.NODE_ENV === 'production',
  /**
   * Stripe, for YapBoard Pro. A restricted key (`rk_…`) is preferred over a secret key (`sk_…`):
   * it only carries the permissions Pro needs, so a leak does much less. Never goes near the browser -
   * only NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY does, and that one is meant to be public.
   */
  stripeSecret: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePrices: {
    /** The base plan: one server, one bot and one client. */
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
    /** One more listing of any kind, bought with a quantity. */
    slotMonthly: process.env.STRIPE_PRICE_SLOT_MONTHLY || '',
    slotAnnual: process.env.STRIPE_PRICE_SLOT_ANNUAL || '',
  },
};

/** Missing, too short, or still the "change-me…" value from .env.example (anyone who has read the repo knows it). */
export const weakSecret = (s: string | undefined, min: number) => !s || s.length < min || /change-me/i.test(s);

/**
 * The single account that owns YapBoard.
 *
 * Deliberately not a database role. `User.role` is a set of permissions staff grant each other and can
 * revoke; this is a statement about whose site it is, which is not something the portal should be able to
 * hand out. Resolved only on the server - the id is never sent to the browser, only the resulting badge.
 */
export const isSiteOwner = (id: string | null | undefined) => Boolean(id) && id === env.ownerId;

/** Real "Login with Yapin'" is configured. Otherwise dev login is used (never in production). */
export const oauthEnabled = () => Boolean(env.clientId && env.clientSecret);
export const devLoginEnabled = () => !oauthEnabled() && !env.isProd;
/** Ownership checks through the bot API are possible. */
export const botEnabled = () => Boolean(env.botToken);

/**
 * Pro can be sold. Without all four the Pro routes answer 503 rather than half-working: a checkout
 * that can't be confirmed by a webhook would take money and grant nothing.
 */
export const billingEnabled = () =>
  Boolean(env.stripeSecret && env.stripeWebhookSecret && env.stripePrices.monthly && env.stripePrices.annual && env.stripePrices.slotMonthly && env.stripePrices.slotAnnual);
