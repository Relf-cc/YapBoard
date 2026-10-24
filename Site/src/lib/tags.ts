export const MAX_TAGS = 5;
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

export function normalizeTags(raw: string[]): string[] {
  return [...new Set(raw.map(normalizeTag).filter(Boolean))].slice(0, MAX_TAGS);
}
