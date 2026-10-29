// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import type { Prisma } from '@prisma/client';
import { BADGE_ORDER, sortBadges, topBadge } from './badges';
import { db } from './db';
import { cardSelect, markPro, toCard, toCards, type ServerCard } from './servers';
import { normalizeTag } from './tags';
import { LANGUAGES } from './languages';

/** 23 so a full page plus the YapBoard Pro card fills the grid evenly (8 rows of 3, 12 of 2). */
export const PAGE_SIZE = 23;
/** Fewer results than this on a page and the Pro card stays out of the way. */
export const AD_MIN_RESULTS = 12;
const RELEVANCE_POOL = 400;

export const SORTS = { relevance: 'Best match', bumped: 'Recently bumped', members: 'Most members', new: 'Newest' } as const;
export type Sort = keyof typeof SORTS;

export const SIZES = { any: 'Any size', small: 'Under 50', medium: '50 – 500', large: '500 – 5k', huge: '5k+' } as const;
export type Size = keyof typeof SIZES;

export type SearchParams = {
  q: string;
  tags: string[];
  lang: string | null;
  size: Size;
  sort: Sort;
  nsfw: boolean;
  /** Only servers with a verified or official checkmark. */
  verified: boolean;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Reads ?q=&tag=a&tag=b&lang=&size=&sort=&nsfw=1&page= into a clean, bounded object. */
export function parseSearch(raw: Raw): SearchParams {
  const q = first(raw.q).trim().slice(0, 100);
  const tagParam = ([] as string[]).concat(raw.tag ?? [], raw.tags ? first(raw.tags).split(',') : []);
  const tags = [...new Set(tagParam.map(normalizeTag).filter(Boolean))].slice(0, 5);
  const lang = first(raw.lang);
  const size = first(raw.size) as Size;
  const sort = first(raw.sort) as Sort;
  const page = Math.min(500, Math.max(1, parseInt(first(raw.page), 10) || 1));
  return {
    q,
    tags,
    lang: lang in LANGUAGES ? lang : null,
    size: size in SIZES ? size : 'any',
    sort: sort in SORTS ? sort : q ? 'relevance' : 'bumped',
    nsfw: first(raw.nsfw) === '1',
    verified: first(raw.verified) === '1',
    page,
  };
}

export function searchHref(p: Partial<SearchParams>, base = '/servers') {
  const u = new URLSearchParams();
  if (p.q) u.set('q', p.q);
  for (const t of p.tags ?? []) u.append('tag', t);
  if (p.lang) u.set('lang', p.lang);
  if (p.size && p.size !== 'any') u.set('size', p.size);
  if (p.sort && !(p.sort === 'relevance' && p.q) && !(p.sort === 'bumped' && !p.q)) u.set('sort', p.sort);
  if (p.nsfw) u.set('nsfw', '1');
  if (p.verified) u.set('verified', '1');
  if (p.page && p.page > 1) u.set('page', String(p.page));
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

const tokenize = (q: string) =>
  [...new Set(q.toLowerCase().split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter((t) => t.length >= 2))].slice(0, 6);

const sizeWhere: Record<Size, Prisma.ServerWhereInput> = {
  any: {},
  small: { memberCount: { lt: 50 } },
  medium: { memberCount: { gte: 50, lt: 500 } },
  large: { memberCount: { gte: 500, lt: 5000 } },
  huge: { memberCount: { gte: 5000 } },
};

const tokenWhere = (t: string): Prisma.ServerWhereInput => ({
  OR: [
    { name: { contains: t } },
    { summary: { contains: t } },
    { description: { contains: t } },
    { tags: { some: { tag: { name: { contains: normalizeTag(t) || t } } } } },
  ],
});

function buildWhere(p: SearchParams, tokens: string[], mode: 'all' | 'any'): Prisma.ServerWhereInput {
  const and: Prisma.ServerWhereInput[] = [{ status: 'PUBLIC' }, sizeWhere[p.size]];
  if (!p.nsfw) and.push({ nsfw: false });
  if (p.lang) and.push({ language: p.lang });
  if (p.verified) and.push({ badges: { some: { kind: { in: ['OFFICIAL', 'VERIFIED'] } } } });
  for (const t of p.tags) and.push({ tags: { some: { tag: { name: t } } } });
  if (tokens.length) and.push(mode === 'all' ? { AND: tokens.map(tokenWhere) } : { OR: tokens.map(tokenWhere) });
  return { AND: and };
}

type Scored = { card: ServerCard; score: number };

function score(s: ServerCard & { description: string }, tokens: string[], phrase: string, now: number): number {
  const name = s.name.toLowerCase();
  const summary = s.summary.toLowerCase();
  const desc = s.description.toLowerCase();
  let total = 0;
  if (phrase.length > 2 && name.includes(phrase)) total += 10;
  for (const t of tokens) {
    const words = name.split(/[^\p{L}\p{N}]+/u);
    if (words.includes(t)) total += 12;
    else if (name.startsWith(t)) total += 8;
    else if (name.includes(t)) total += 5;
    const nt = normalizeTag(t);
    if (s.tags.includes(nt)) total += 7;
    else if (s.tags.some((tag) => tag.includes(nt))) total += 3;
    if (summary.includes(t)) total += 2;
    if (desc.includes(t)) total += 1;
  }
  // Light tie-breakers: active (recently bumped) and bigger servers float up a little.
  if (s.bumpedAt) total += Math.max(0, 3 - (now - new Date(s.bumpedAt).getTime()) / 8.64e7);
  total += Math.log10(s.memberCount + 1) * 0.8;
  // A checkmark lifts a server a little; the decorative badges count for less, and only up to a point.
  if (s.badges.includes('OFFICIAL')) total += 3;
  else if (s.badges.includes('VERIFIED')) total += 2;
  total += Math.min(1.5, s.badges.filter((b) => b !== 'OFFICIAL' && b !== 'VERIFIED').length * 0.5);
  return total;
}

export type SearchResult = {
  items: ServerCard[];
  total: number;
  pages: number;
  loose: boolean;
  facets: { name: string; count: number }[];
};

const orderBy: Record<Exclude<Sort, 'relevance'>, Prisma.ServerOrderByWithRelationInput[]> = {
  // rankedAt: the last bump, nudged forward by votes since (lib/votes.ts).
  bumped: [{ rankedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  members: [{ memberCount: 'desc' }, { rankedAt: { sort: 'desc', nulls: 'last' } }],
  new: [{ createdAt: 'desc' }],
};

export async function search(p: SearchParams): Promise<SearchResult> {
  const tokens = tokenize(p.q);
  let where = buildWhere(p, tokens, 'all');
  let total = await db.server.count({ where });
  let loose = false;
  // Nothing matches every word: fall back to servers matching any of them.
  if (!total && tokens.length > 1) {
    where = buildWhere(p, tokens, 'any');
    total = await db.server.count({ where });
    loose = total > 0;
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(p.page, pages);

  let items: ServerCard[];
  if (p.sort === 'relevance' && tokens.length) {
    const pool = await db.server.findMany({
      where,
      select: { ...cardSelect, description: true },
      orderBy: { rankedAt: { sort: 'desc', nulls: 'last' } },
      take: RELEVANCE_POOL,
    });
    const now = Date.now();
    const phrase = p.q.toLowerCase();
    const ranked: Scored[] = pool.map(({ description, ...row }) => {
      const card = toCard(row);
      return { card, score: score({ ...card, description }, tokens, phrase, now) };
    });
    ranked.sort((a, b) => b.score - a.score);
    // Marked after slicing: the pool is up to RELEVANCE_POOL rows, and only this page gets shown.
    items = await markPro(ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.card));
  } else {
    const rows = await db.server.findMany({
      where,
      select: cardSelect,
      orderBy: orderBy[p.sort === 'relevance' ? 'bumped' : p.sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    items = await toCards(rows);
  }

  // Tags common among the results, to narrow the search further.
  const grouped = await db.serverTag.groupBy({
    by: ['tagId'],
    where: { server: where, tag: { name: { notIn: p.tags } } },
    _count: { tagId: true },
    orderBy: { _count: { tagId: 'desc' } },
    take: 14,
  });
  const tagRows = await db.tag.findMany({ where: { id: { in: grouped.map((g) => g.tagId) } }, select: { id: true, name: true } });
  const nameById = new Map(tagRows.map((t) => [t.id, t.name]));
  const facets = grouped.map((g) => ({ name: nameById.get(g.tagId) ?? '', count: g._count.tagId })).filter((f) => f.name);

  return { items, total, pages, loose, facets };
}

/** Autocomplete: matching tags and server names. */
export async function suggest(q: string) {
  const t = q.trim().toLowerCase().slice(0, 50);
  if (t.length < 1) return { tags: [], servers: [] };
  const nt = normalizeTag(t);
  const [tags, servers] = await Promise.all([
    nt
      ? db.tag.findMany({
          where: { name: { startsWith: nt }, servers: { some: { server: { status: 'PUBLIC' } } } },
          select: { name: true, _count: { select: { servers: true } } },
          orderBy: { servers: { _count: 'desc' } },
          take: 5,
        })
      : [],
    db.server.findMany({
      where: { status: 'PUBLIC', nsfw: false, name: { contains: t } },
      select: { id: true, name: true, iconUrl: true, memberCount: true, badges: { select: { kind: true } } },
      orderBy: { memberCount: 'desc' },
      take: 20,
    }),
  ]);
  // Most important badge first, then biggest.
  const rank = (s: { badges: { kind: string }[] }) => {
    const top = topBadge(s.badges.map((b) => b.kind));
    return top ? BADGE_ORDER.length - BADGE_ORDER.indexOf(top) : 0;
  };
  servers.sort((a, b) => rank(b) - rank(a) || b.memberCount - a.memberCount);
  return {
    tags: tags.map((x) => ({ name: x.name, count: x._count.servers })),
    servers: servers.slice(0, 5).map((s) => ({ ...s, badges: sortBadges(s.badges.map((b) => b.kind)) })),
  };
}

export async function popularTags(limit = 24) {
  const grouped = await db.serverTag.groupBy({
    by: ['tagId'],
    where: { server: { status: 'PUBLIC', nsfw: false } },
    _count: { tagId: true },
    orderBy: { _count: { tagId: 'desc' } },
    take: limit,
  });
  const rows = await db.tag.findMany({ where: { id: { in: grouped.map((g) => g.tagId) } } });
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return grouped.map((g) => ({ name: byId.get(g.tagId)!, count: g._count.tagId })).filter((t) => t.name);
}
