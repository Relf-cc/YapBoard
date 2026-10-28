// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';

export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  portalUrl: (process.env.PORTAL_URL || 'http://localhost:3000/portal').replace(/\/$/, ''),
  /** The developer platform (src/lib/platform.ts), on its own host in production. */
  platformUrl: (process.env.PLATFORM_URL || 'http://localhost:3000/platform').replace(/\/$/, ''),
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
