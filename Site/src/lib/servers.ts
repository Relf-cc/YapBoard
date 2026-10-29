// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { sortBadges, type BadgeKind } from './badges';
import { db } from './db';
import { LANGUAGES } from './languages';
import { normalizeTags } from './tags';
import { isTheme, MAX_SCREENSHOTS } from './client-fields';
import { limitsFor, MAX_LINK_LABEL, readLinks, type Limits } from './pro-fields';
import { proSet } from './pro';
import { isUploadPath } from './upload-fields';
import type { SessionUser } from './session';
import { isStaff } from './session';

export const BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Fields every server card needs. */
export const cardSelect = {
  id: true,
  name: true,
  iconUrl: true,
  summary: true,
  memberCount: true,
  bumpedAt: true,
  language: true,
  nsfw: true,
  accent: true,
  badges: { select: { kind: true } },
  tags: { select: { tag: { select: { name: true } } } },
  // Not drawn anywhere. It's what `toCards` needs to work out which cards are on Pro in one query.
  ownerId: true,
} satisfies Prisma.ServerSelect;

type CardRow = Prisma.ServerGetPayload<{ select: typeof cardSelect }>;

export type ServerCard = Omit<CardRow, 'tags' | 'bumpedAt' | 'badges'> & {
  tags: string[];
  bumpedAt: string | null;
  badges: BadgeKind[];
  /** Covered by a Pro plan right now. `toCard` says no; only `toCards` goes and looks. */
  pro: boolean;
};

export const toCard = (s: CardRow): ServerCard => ({
  ...s,
  bumpedAt: s.bumpedAt ? s.bumpedAt.toISOString() : null,
  tags: s.tags.map((t) => t.tag.name),
  badges: sortBadges(s.badges.map((b) => b.kind)),
  pro: false,
});

/**
 * Cards for a whole page of rows, Pro marks included.
 *
 * Always prefer this to mapping `toCard` yourself: it costs one extra pair of queries for the entire
 * page (see `proSet`), where asking per card would cost a pair per owner. `toCard` alone is for the
 * places with no page to batch - the form preview, and anywhere the mark isn't drawn.
 */
export async function toCards(rows: readonly CardRow[]): Promise<ServerCard[]> {
  return markPro(rows.map(toCard));
}

/**
 * Fill in the Pro mark on cards that are already built. Use this rather than `toCards` when the page
 * being shown is a slice of a bigger pool - ranked search results, say - so the lookup only covers the
 * cards somebody is actually going to see.
 */
export async function markPro(cards: ServerCard[]): Promise<ServerCard[]> {
  const pro = await proSet('server', cards.map((c) => c.id));
  if (!pro.size) return cards;
  return cards.map((c) => (pro.has(c.id) ? { ...c, pro: true } : c));
}

/** A server's screenshots as stored, cut to what the caps allow. Junk is dropped, never thrown. */
export function readScreenshots(raw: string | null | undefined, max = MAX_SCREENSHOTS): string[] {
  if (!raw || max <= 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && (isUploadPath(x) || /^https:\/\/\S+\.\S+/.test(x))).slice(0, max);
  } catch {
    return [];
  }
}

export { readLinks };

/** Listing is visible to the public on /view (unlisted ones too, via direct link). */
export const isViewable = (status: string) => status === 'PUBLIC' || status === 'UNLISTED';

export function canManageListing(user: SessionUser | null, server: { ownerId: string }) {
  return !!user && !user.bannedAt && (user.id === server.ownerId || isStaff(user));
}

export const inviteRe = /^https:\/\/(www\.)?(yapin\.gg|yapper\.website)\/(invite|i)\/[A-Za-z0-9_-]{2,64}\/?$/;

/** "Needs Pro" when the listing has none of these at all, otherwise "you've used them all". */
const capMessage = (n: number, noun: string) => (n === 0 ? `${noun} need YapBoard Pro` : `Up to ${n} ${noun.toLowerCase()}`);

/**
 * The shape of a listing save, for a listing with these caps.
 *
 * A factory rather than a constant because what a listing may contain depends on whether a Pro plan
 * covers it, and answering that needs the database. The numbers live in src/lib/pro-fields.ts.
 *
 * Two rules stop a lapsed plan from costing anybody their work:
 *
 * - A field the listing isn't entitled to is **ignored**, never blanked. The route spreads only the keys
 *   the caps allow, so the column keeps what it had and a renewal brings it straight back.
 * - A field it has outgrown - 6000 characters of description, then a cancellation - is grandfathered by
 *   the caller (see `grandfather` in src/lib/pro.ts), so ordinary edits still save.
 */
export const listingSchemaFor = (limits: Limits) =>
  z.object({
    summary: z.string().trim().min(10, 'Give it at least 10 characters').max(140, 'Keep it under 140 characters'),
    description: z
      .string()
      .trim()
      .min(30, 'Tell people a bit more (30+ characters)')
      .max(limits.description, `Max ${limits.description} characters`),
    inviteUrl: z
      .string()
      .trim()
      .transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v))
      .refine((v) => inviteRe.test(v), "Use a Yapin' invite link, like https://yapin.gg/invite/your-server"),
    language: z.string().refine((v) => v in LANGUAGES, 'Pick a language'),
    nsfw: z.boolean(),
    unlisted: z.boolean(),
    /// Opt out of the global messages YapBoard staff send through the bot (src/lib/broadcasts.ts).
    broadcastsOff: z.boolean(),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a colour'),
    tags: z
      .array(z.string().max(40))
      .max(20)
      .transform(normalizeTags)
      .refine((t) => t.length >= 1, 'Add at least one tag')
      .refine((t) => t.length <= limits.tags, `Up to ${limits.tags} tags`),
    /// Pro perks. Validated here, then dropped by the route unless the caps allow them.
    theme: z.string().refine(isTheme, 'Pick a style').optional(),
    screenshots: z
      .array(z.string().trim().max(500))
      .max(20)
      .transform((list) => list.map((x) => (x && !x.startsWith('/') && !/^https?:\/\//.test(x) ? `https://${x}` : x)).filter(Boolean))
      .refine((list) => list.every((x) => isUploadPath(x) || /^https:\/\/\S+\.\S+/.test(x)), 'Screenshots need full https links or uploaded images')
      .refine((list) => list.length <= limits.screenshots, capMessage(limits.screenshots, 'Screenshots'))
      .optional(),
    links: z
      .array(z.object({ label: z.string().trim().max(MAX_LINK_LABEL, `Keep labels under ${MAX_LINK_LABEL} characters`), url: z.string().trim().max(500) }))
      .max(10)
      .transform((list) => list.map((l) => ({ ...l, url: l.url && !/^https?:\/\//.test(l.url) ? `https://${l.url}` : l.url })).filter((l) => l.label || l.url))
      .refine((list) => list.every((l) => l.label), 'Give every link a label')
      .refine((list) => list.every((l) => /^https:\/\/\S+\.\S+/.test(l.url)), 'Links need a full https address')
      .refine((list) => list.length <= limits.links, capMessage(limits.links, 'Extra links'))
      .optional(),
  });

/** Free-listing shape. A server that doesn't exist yet can't be on Pro, so this is what `POST` accepts. */
export const listingSchema = listingSchemaFor(limitsFor('server', false));

export type ListingInput = z.infer<typeof listingSchema>;

/**
 * The columns a save writes, with the Pro-only ones dropped unless the caps allow them.
 *
 * Dropping rather than rejecting is what makes the lapse rule work: `undefined` is how Prisma is told to
 * leave a column alone, so a lapsed listing's banner theme and screenshots sit untouched in the row while
 * the page stops drawing them.
 */
export function listingData(input: ListingInput, limits: Limits) {
  const { tags, unlisted, theme, screenshots, links, ...rest } = input;
  return {
    ...rest,
    ...(limits.themes && theme !== undefined && { theme }),
    ...(limits.screenshots > 0 && screenshots !== undefined && { screenshots: JSON.stringify(screenshots) }),
    ...(limits.links > 0 && links !== undefined && { links: JSON.stringify(links) }),
  };
}

/** Replace a server's tags, creating missing ones. */
export async function setTags(tx: Prisma.TransactionClient, serverId: string, tags: string[]) {
  await tx.serverTag.deleteMany({ where: { serverId } });
  for (const name of tags) {
    const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} });
    await tx.serverTag.create({ data: { serverId, tagId: tag.id } });
  }
}

export type BumpResult = { ok: true; bumpCount: number; nextAt: string } | { ok: false; reason: 'not_found' | 'not_listed' | 'cooldown'; nextAt?: string };

/** Moves a server to the top of the bumped sort. 2 hour cooldown per server. */
export async function bumpServer(serverId: string, userId: string, source: 'bot' | 'web', appId?: string | null): Promise<BumpResult> {
  const server = await db.server.findUnique({ where: { id: serverId }, select: { status: true, bumpedAt: true } });
  if (!server) return { ok: false, reason: 'not_found' };
  if (server.status !== 'PUBLIC') return { ok: false, reason: 'not_listed' };
  const now = Date.now();
  if (server.bumpedAt && now - server.bumpedAt.getTime() < BUMP_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', nextAt: new Date(server.bumpedAt.getTime() + BUMP_COOLDOWN_MS).toISOString() };
  }
  const updated = await db.$transaction(async (tx) => {
    // Re-check inside the transaction so two bumps at once can't both land.
    const res = await tx.server.updateMany({
      where: { id: serverId, OR: [{ bumpedAt: null }, { bumpedAt: { lt: new Date(now - BUMP_COOLDOWN_MS) } }] },
      // No votes since this bump yet, so it ranks exactly at the bump (see lib/votes.ts).
      data: { bumpedAt: new Date(now), rankedAt: new Date(now), bumpCount: { increment: 1 } },
    });
    if (!res.count) return null;
    await tx.bump.create({ data: { serverId, userId, source, appId: appId ?? null } });
    return tx.server.findUnique({ where: { id: serverId }, select: { bumpCount: true } });
  });
  if (!updated) return { ok: false, reason: 'cooldown' };
  return { ok: true, bumpCount: updated.bumpCount, nextAt: new Date(now + BUMP_COOLDOWN_MS).toISOString() };
}
