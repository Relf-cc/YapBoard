// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * The parts of a client listing's shape that the form in the browser needs as well as the server: the choices
 * on the page, and the limits behind the counters next to them.
 *
 * They live here rather than in src/lib/clients.ts because that file is `server-only` — it reaches the
 * database and GitHub — and a client component importing it would drag all of that into the browser bundle.
 * src/lib/clients.ts re-exports everything here, so server code can keep importing from one place.
 */

/** Backdrops for the hero on a client's page. The lister picks one; the page draws it (clients/[slug]/page.tsx). */
export const THEMES = {
  GLOW: 'Glow',
  GRID: 'Grid',
  WAVE: 'Wave',
  FLAT: 'Flat',
} as const;

export type Theme = keyof typeof THEMES;
export const isTheme = (v: unknown): v is Theme => typeof v === 'string' && v in THEMES;

/** Where a listing's downloads come from. GITHUB reads releases; MANUAL means the lister keeps the links. */
export const RELEASE_SOURCES = { GITHUB: 'GitHub releases', MANUAL: 'Links I keep myself' } as const;
export type ReleaseSource = keyof typeof RELEASE_SOURCES;

export const MAX_SCREENSHOTS = 6;
/** Manual download rows a lister can keep. Enough for every platform twice over, not a file index. */
export const MAX_MANUAL_FILES = 12;

/** Pages under /clients that aren't listings, so no listing may take their name. */
export const RESERVED_SLUGS = new Set(['add', 'new', 'help', 'terms', 'edit', 'manage', 'api', 'search', 'all', 'download']);

/** "Yapin+ Client!" → "yapin-client". Returns '' when nothing usable is left. */
export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}
