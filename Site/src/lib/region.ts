// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * Where a buyer appears to be, and whether that means they get a cancellation right we have to ask about.
 *
 * Consumers in the UK and the EEA have a statutory right to cancel a purchase within 14 days. For a
 * *service* that right can be given up, but only in the way the law allows: the buyer has to expressly
 * ask for the service to start straight away and acknowledge what that costs them. A checkbox saying "I
 * accept no refund" is not that, and a term like it is likely to be unenforceable - so this file carries
 * the wording that does work, and `WAIVER_VERSION` records which wording somebody agreed to.
 *
 * No `server-only`: the checkbox on /pro renders in the browser and needs the same wording.
 */

/**
 * Countries whose consumers have the 14-day right: the EU 27, the UK, and the three non-EU EEA states,
 * which follow the same directive. Switzerland is deliberately absent - it isn't in the EEA.
 */
export const WITHDRAWAL_COUNTRIES = new Set([
  // EU 27
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  // United Kingdom
  'GB',
  // EEA, non-EU
  'IS', 'LI', 'NO',
]);

/**
 * The two-letter country Cloudflare says the request came from.
 *
 * Cloudflare sets `CF-IPCountry` on every request it proxies and Caddy passes it through untouched. It is
 * a **convenience, not a security control**: nothing here depends on it being honest, because the only
 * thing a buyer gains by faking it is the cancellation right they would otherwise have given up. Faking
 * it to *lose* a right is not a thing people do.
 *
 * Returns null when there's no header at all, which in practice means local development.
 */
export function buyerCountry(h: Headers): string | null {
  const raw = (h.get('cf-ipcountry') || '').trim().toUpperCase();
  // Cloudflare sends XX when it can't tell, and T1 for Tor.
  if (!raw || raw === 'XX' || raw === 'T1' || !/^[A-Z]{2}$/.test(raw)) return null;
  return raw;
}

/**
 * Does this buyer have to be asked about the cancellation right before we charge them?
 *
 * An unknown country counts as yes, on purpose. Getting it wrong one way shows a checkbox to somebody in
 * Ohio who didn't need it; getting it wrong the other way takes money from somebody in Berlin without
 * the consent that makes it stick. The first is a moment's friction and the second is a refund we have
 * to give, so the doubt resolves towards asking.
 */
export const needsWithdrawalWaiver = (h: Headers): boolean => {
  const country = buyerCountry(h);
  return country === null || WITHDRAWAL_COUNTRIES.has(country);
};

/**
 * Which wording somebody agreed to, stored with their consent.
 *
 * Bump it whenever `WAIVER_TEXT` changes in substance, and never reuse a version for different words:
 * the whole value of the record is being able to say exactly what was on screen when they ticked it.
 */
export const WAIVER_VERSION = 'withdrawal-v1';

/**
 * The checkbox. Worded as the law recognises rather than as a flat "no refunds", because that is what
 * actually gives up the right - and because a term a court would strike out protects nobody.
 *
 * Two halves, both required: the express request to begin now, and the acknowledgement of what it costs.
 */
export const WAIVER_TEXT =
  'I ask YapBoard Pro to start straight away, and I accept that once a billing period has been supplied I lose my 14-day right to cancel it and won’t be refunded for it.';

/** The short version, for the terms page and for receipts. */
export const WAIVER_SUMMARY = 'asked for the plan to start immediately and gave up the 14-day cancellation right for each period once supplied';
