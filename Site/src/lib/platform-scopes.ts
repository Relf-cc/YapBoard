// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * What the developer platform hands out, as plain data: the scopes, which endpoint needs which one, and the
 * statuses an app can be in. No database and no 'server-only', because the forms on platform.yapboard.dev
 * render these in the browser - src/lib/platform.ts holds everything that needs a session or a query, and
 * re-exports this file so server code only ever imports one module.
 */

/* ---------------- scopes ---------------- */

export const SCOPES = {
  bump: {
    label: 'Bump listings',
    /** What the developer's own users end up typing. */
    command: '/bump',
    blurb: 'Move a listed server, bot or client to the top of its board, on the same two-hour cooldown as YapBoard’s own bot. Bots and clients only from the server they belong to.',
    /** Shown on the docs page, so one scope reads as one feature. */
    endpoints: ['POST /servers/{serverId}/bump', 'POST /bots/{botId}/bump', 'POST /clients/{client}/bump'],
  },
  search: {
    label: 'Search the boards',
    command: '/findserver',
    blurb: 'Search public listings on all three boards — servers, bots and clients — by name or tag, for an in-chat browser.',
    endpoints: ['GET /search/servers', 'GET /search/bots', 'GET /search/clients'],
  },
  listing: {
    label: 'Read server listings',
    command: '/yapboard',
    blurb: 'A server’s listing: status, bumps, members, tags, badges and when it can bump again.',
    endpoints: ['GET /servers/{serverId}'],
  },
  bots: {
    label: 'Read bot listings',
    command: '/botinfo',
    blurb: 'A bot listing: summary, servers, badges and its support server.',
    endpoints: ['GET /bots/{botId}'],
  },
} as const;

export type Scope = keyof typeof SCOPES;
export const SCOPE_ORDER = Object.keys(SCOPES) as Scope[];
export const isScope = (s: unknown): s is Scope => typeof s === 'string' && s in SCOPES;

/** Scopes are stored as a JSON array (SQLite has no array type). Anything unrecognised is dropped on read. */
export function readScopes(raw: string | null | undefined): Scope[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return SCOPE_ORDER.filter((s) => parsed.includes(s));
  } catch {
    return [];
  }
}

/** Always written in SCOPE_ORDER, deduplicated, so two equal sets are the same string. */
export const writeScopes = (scopes: readonly string[]) => JSON.stringify(SCOPE_ORDER.filter((s) => scopes.includes(s)));

/**
 * Which scope each endpoint needs. The keys double as PlatformUsage.endpoint, so they name the board as well
 * as the action: a developer looking at their usage wants to see that it's bot bumps failing, not "bumps".
 * `me` needs no scope — holding a live key is the whole of the question it answers.
 */
export const ENDPOINTS = {
  me: null,
  'search.servers': 'search',
  'search.bots': 'search',
  'search.clients': 'search',
  'bump.servers': 'bump',
  'bump.bots': 'bump',
  'bump.clients': 'bump',
  listing: 'listing',
  bots: 'bots',
} as const satisfies Record<string, Scope | null>;

export type Endpoint = keyof typeof ENDPOINTS;

/* ---------------- statuses ---------------- */

export const APP_STATUS: Record<string, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused by you',
  SUSPENDED: 'Suspended by staff',
  REVOKED: 'Revoked',
};

/** An app that may call the API - if its member is in good standing too. */
export const appLive = (status: string) => status === 'ACTIVE';

/* ---------------- limits ---------------- */

/**
 * Per-app rate limits, counted per minute. Generous for a bot serving its own users, tight enough that a
 * loop in somebody's code can't walk the whole board - bumps are lower because each one moves a real
 * listing, and a bot has no business sending thirty a minute.
 */
export const RATE = { perMinute: 120, bumpPerMinute: 30 } as const;
