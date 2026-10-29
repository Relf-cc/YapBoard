// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { sortBadges, type BadgeKind } from './badges';
import { db } from './db';
import { LANGUAGES } from './languages';
import { normalizeTags } from './tags';
import { limitsFor, type Limits } from './pro-fields';
import { canManage } from './manage';

/**
 * Bot listings: the same idea as a server listing, for the bots people run on Yapin'.
 *
 * A bot is listed against its Yapin' bot id - the one people paste into Server settings → Bots - so the "Add"
 * button can hand that straight over. Ownership is checked the same way servers are, but against the bot's
 * support server: whoever lists a bot has to be the owner or an admin of the server that supports it. That's a
 * real signal (you can't run a bot's support server without running the bot) and it reuses lib/yapin.ts.
 *
 * Bots share tags and badges with servers, and bump on the same 2 hour cooldown - but from the site, since a bot
 * can't type /bump about itself.
 */

/** Same as servers, so "recently bumped" means the same thing across both boards. */
export const BOT_BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export const botCardSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  summary: true,
  serverCount: true,
  bumpedAt: true,
  language: true,
  nsfw: true,
  accent: true,
  prefix: true,
  badges: { select: { kind: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.BotListingSelect;

type BotCardRow = Prisma.BotListingGetPayload<{ select: typeof botCardSelect }>;

export type BotCard = Omit<BotCardRow, 'tags' | 'bumpedAt' | 'badges'> & { tags: string[]; bumpedAt: string | null; badges: BadgeKind[] };

export const toBotCard = (b: BotCardRow): BotCard => ({
  ...b,
  bumpedAt: b.bumpedAt ? b.bumpedAt.toISOString() : null,
  tags: b.tags.map((t) => t.tag.name),
  badges: sortBadges(b.badges.map((x) => x.kind)),
});

export const isBotViewable = (status: string) => status === 'PUBLIC' || status === 'UNLISTED';

/** Waiting on staff. Not viewable, not bumpable, not in search - only the lister and staff see it. */
export const isBotPending = (status: string) => status === 'PENDING';

/** Staff said no. The lister can edit and save, which puts it back in the queue (api/bots/[botId] PATCH). */
export const isBotDenied = (status: string) => status === 'DENIED';

/** Where an approved listing goes: back to whatever the lister asked for. */
export const approvedStatus = (requestedUnlisted: boolean) => (requestedUnlisted ? 'UNLISTED' : 'PUBLIC');

/** Statuses a lister can still edit their way out of. HIDDEN and REMOVED are staff decisions that stay put. */
export const isOwnerEditable = (status: string) => status === 'PUBLIC' || status === 'UNLISTED' || status === 'PENDING' || status === 'DENIED';

/** Owner, co-manager or staff. See src/lib/manage.ts - the `managers` select is required by the type. */
export const canManageBot = canManage;

/** An optional text field: missing, empty and null all mean "not set". */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/** The same, for a link. A bare "example.com" is read as https, anything else has to look like a URL. */
const httpsUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v))
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/\S+\.\S+/.test(v), message);

/**
 * The shape of a bot listing save, for a listing with these caps. A factory for the same reason the
 * server one is - see the long note on `listingSchemaFor` in src/lib/servers.ts.
 */
export const botListingSchemaFor = (limits: Limits) =>
  z.object({
    summary: z.string().trim().min(10, 'Give it at least 10 characters').max(140, 'Keep it under 140 characters'),
    description: z.string().trim().min(30, 'Tell people a bit more (30+ characters)').max(limits.description, `Max ${limits.description} characters`),
    /// Where people can read more or add it from the bot's own page. Optional: the bot id is enough to add it.
    inviteUrl: httpsUrl('Use a full https link, or leave it empty'),
    website: httpsUrl('Use a full https link, or leave it empty'),
    prefix: optional(8),
    library: optional(40),
    language: z.string().refine((v) => v in LANGUAGES, 'Pick a language'),
    nsfw: z.boolean(),
    unlisted: z.boolean(),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a colour'),
    tags: z
      .array(z.string().max(40))
      .max(20)
      .transform(normalizeTags)
      .refine((t) => t.length >= 1, 'Add at least one tag')
      .refine((t) => t.length <= limits.tags, `Up to ${limits.tags} tags`),
  });

/** Free-listing shape. A bot that doesn't exist yet can't be on Pro, so this is what `POST` accepts. */
export const botListingSchema = botListingSchemaFor(limitsFor('bot', false));

export type BotListingInput = z.infer<typeof botListingSchema>;

/** Replace a bot's tags, creating missing ones. Tags are shared with servers (the Tag table). */
export async function setBotTags(tx: Prisma.TransactionClient, botId: string, tags: string[]) {
  await tx.botTag.deleteMany({ where: { botId } });
  for (const name of tags) {
    const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} });
    await tx.botTag.create({ data: { botId, tagId: tag.id } });
  }
}

export type BotBumpResult = { ok: true; bumpCount: number; nextAt: string } | { ok: false; reason: 'not_found' | 'not_listed' | 'cooldown'; nextAt?: string };

/** Moves a bot to the top of the bumped sort. Same 2 hour cooldown as servers, but pressed on the site. */
export async function bumpBot(botId: string, userId: string, appId?: string | null): Promise<BotBumpResult> {
  const bot = await db.botListing.findUnique({ where: { id: botId }, select: { status: true, bumpedAt: true } });
  if (!bot) return { ok: false, reason: 'not_found' };
  if (bot.status !== 'PUBLIC') return { ok: false, reason: 'not_listed' };
  const now = Date.now();
  if (bot.bumpedAt && now - bot.bumpedAt.getTime() < BOT_BUMP_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', nextAt: new Date(bot.bumpedAt.getTime() + BOT_BUMP_COOLDOWN_MS).toISOString() };
  }
  const updated = await db.$transaction(async (tx) => {
    // Re-check inside the transaction so two bumps at once can't both land.
    const res = await tx.botListing.updateMany({
      where: { id: botId, OR: [{ bumpedAt: null }, { bumpedAt: { lt: new Date(now - BOT_BUMP_COOLDOWN_MS) } }] },
      data: { bumpedAt: new Date(now), bumpCount: { increment: 1 } },
    });
    if (!res.count) return null;
    await tx.botBump.create({ data: { botId, userId, appId: appId ?? null } });
    return tx.botListing.findUnique({ where: { id: botId }, select: { bumpCount: true } });
  });
  if (!updated) return { ok: false, reason: 'cooldown' };
  return { ok: true, bumpCount: updated.bumpCount, nextAt: new Date(now + BOT_BUMP_COOLDOWN_MS).toISOString() };
}

/* ---------------- browsing ---------------- */

export const BOT_SORTS = { bumped: 'Recently bumped', servers: 'Most servers', new: 'Newest', name: 'A to Z' } as const;
export type BotSort = keyof typeof BOT_SORTS;

export const BOTS_PAGE_SIZE = 24;

export type BotSearchParams = { q: string; tags: string[]; sort: BotSort; nsfw: boolean; verified: boolean; page: number };

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseBotSearch(raw: Record<string, string | string[] | undefined>): BotSearchParams {
  const sort = firstOf(raw.sort) as BotSort;
  const tagParam = ([] as string[]).concat(raw.tag ?? []);
  return {
    q: firstOf(raw.q).trim().slice(0, 100),
    tags: [...new Set(tagParam.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 5),
    sort: sort in BOT_SORTS ? sort : 'bumped',
    nsfw: firstOf(raw.nsfw) === '1',
    verified: firstOf(raw.verified) === '1',
    page: Math.min(200, Math.max(1, parseInt(firstOf(raw.page), 10) || 1)),
  };
}

export function botSearchHref(p: Partial<BotSearchParams>) {
  const u = new URLSearchParams();
  if (p.q) u.set('q', p.q);
  for (const t of p.tags ?? []) u.append('tag', t);
  if (p.sort && p.sort !== 'bumped') u.set('sort', p.sort);
  if (p.nsfw) u.set('nsfw', '1');
  if (p.verified) u.set('verified', '1');
  if (p.page && p.page > 1) u.set('page', String(p.page));
  const s = u.toString();
  return s ? `/bots?${s}` : '/bots';
}

const botOrderBy: Record<BotSort, Prisma.BotListingOrderByWithRelationInput[]> = {
  bumped: [{ bumpedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  servers: [{ serverCount: 'desc' }, { bumpedAt: { sort: 'desc', nulls: 'last' } }],
  new: [{ createdAt: 'desc' }],
  name: [{ name: 'asc' }],
};

export async function searchBots(p: BotSearchParams) {
  const and: Prisma.BotListingWhereInput[] = [{ status: 'PUBLIC' }];
  if (!p.nsfw) and.push({ nsfw: false });
  if (p.verified) and.push({ badges: { some: { kind: { in: ['OFFICIAL', 'VERIFIED'] } } } });
  for (const t of p.tags) and.push({ tags: { some: { tag: { name: t } } } });
  if (p.q) {
    and.push({
      OR: [{ name: { contains: p.q } }, { summary: { contains: p.q } }, { description: { contains: p.q } }, { tags: { some: { tag: { name: { contains: p.q.toLowerCase() } } } } }],
    });
  }
  const where: Prisma.BotListingWhereInput = { AND: and };

  const total = await db.botListing.count({ where });
  const pages = Math.max(1, Math.ceil(total / BOTS_PAGE_SIZE));
  const page = Math.min(p.page, pages);
  const rows = await db.botListing.findMany({
    where,
    select: botCardSelect,
    orderBy: botOrderBy[p.sort],
    skip: (page - 1) * BOTS_PAGE_SIZE,
    take: BOTS_PAGE_SIZE,
  });

  // Tags common among the results, to narrow it down further.
  const grouped = await db.botTag.groupBy({
    by: ['tagId'],
    where: { bot: where, tag: { name: { notIn: p.tags } } },
    _count: { tagId: true },
    orderBy: { _count: { tagId: 'desc' } },
    take: 12,
  });
  const tagRows = await db.tag.findMany({ where: { id: { in: grouped.map((g) => g.tagId) } }, select: { id: true, name: true } });
  const nameById = new Map(tagRows.map((t) => [t.id, t.name]));

  return {
    items: rows.map(toBotCard),
    total,
    pages,
    page,
    facets: grouped.map((g) => ({ name: nameById.get(g.tagId) ?? '', count: g._count.tagId })).filter((f) => f.name),
  };
}
