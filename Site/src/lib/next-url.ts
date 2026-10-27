// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/** Only same-site paths (or the portal) are allowed after login, so ?next= can't be an open redirect. */
export function safeNext(next: string | null | undefined, portalUrl?: string): string {
  if (!next) return '/';
  // Browsers drop tabs and newlines from URLs and read \ as /, so "/\t/evil.com" would become "//evil.com".
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return '/';
  if (portalUrl && (next === portalUrl || next.startsWith(portalUrl + '/'))) return next;
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  // Last check: resolved against a dummy origin, the path must stay on it.
  try {
    if (new URL(next, 'http://same.invalid').origin !== 'http://same.invalid') return '/';
  } catch {
    return '/';
  }
  return next;
}

/** What /login?error= can say. Anything else in the URL is ignored. */
export const LOGIN_ERRORS = {
  expired: 'Your login took too long. Try again.',
  cancelled: 'Login was cancelled.',
  denied: 'Yapin’ said no. Try again.',
  state: 'Login check failed. Try again.',
  banned: 'This account is banned from YapBoard.',
  failed: 'Couldn’t log you in with Yapin’. Try again.',
} as const;

export type LoginError = keyof typeof LOGIN_ERRORS;

export const loginError = (code: string | undefined) => (code && Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code as LoginError] : null);
