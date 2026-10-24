import 'server-only';

export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  portalUrl: (process.env.PORTAL_URL || 'http://localhost:3000/portal').replace(/\/$/, ''),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  clientId: process.env.YAPIN_CLIENT_ID || '',
  clientSecret: process.env.YAPIN_CLIENT_SECRET || '',
  botToken: process.env.YAPPER_BOT_TOKEN || '',
  internalSecret: process.env.INTERNAL_API_SECRET || '',
  staffIds: (process.env.STAFF_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  isProd: process.env.NODE_ENV === 'production',
};

/** Missing, too short, or still the "change-me…" value from .env.example (anyone who has read the repo knows it). */
export const weakSecret = (s: string | undefined, min: number) => !s || s.length < min || /change-me/i.test(s);

/** Real "Login with Yapin'" is configured. Otherwise dev login is used (never in production). */
export const oauthEnabled = () => Boolean(env.clientId && env.clientSecret);
export const devLoginEnabled = () => !oauthEnabled() && !env.isProd;
/** Ownership checks through the bot API are possible. */
export const botEnabled = () => Boolean(env.botToken);
