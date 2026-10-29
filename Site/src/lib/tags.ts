// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/** Tags on a free listing. YapBoard Pro raises it - the caps table is in src/lib/pro-fields.ts. */
export const MAX_TAGS = 5;
/** Tags on a listing covered by a Pro plan. */
export const MAX_TAGS_PRO = 10;
export const MAX_TAG_LEN = 24;

/** "Anime & Manga " → "anime-manga". Returns '' when nothing usable is left. */
export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // drop accents: café → cafe
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TAG_LEN)
    .replace(/-+$/, '');
}

/**
 * Clean and dedupe a set of tags.
 *
 * Deliberately does **not** cut the list to a cap. It used to, and because the schema then checked the
 * already-cut list, the check could never fail: a request with twelve tags quietly saved five and told
 * nobody. How many tags are allowed depends on the listing's plan, so the schemas validate the count and
 * refuse what's over - silently dropping somebody's work is not a cap, it's a bug.
 */
export function normalizeTags(raw: string[]): string[] {
  return [...new Set(raw.map(normalizeTag).filter(Boolean))];
}
