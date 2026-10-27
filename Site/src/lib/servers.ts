// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { sortBadges, type BadgeKind } from './badges';
import { db } from './db';
import { LANGUAGES } from './languages';
import { MAX_TAGS, normalizeTags } from './tags';
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
} satisfies Prisma.ServerSelect;

type CardRow = Prisma.ServerGetPayload<{ select: typeof cardSelect }>;

export type ServerCard = Omit<CardRow, 'tags' | 'bumpedAt' | 'badges'> & { tags: string[]; bumpedAt: string | null; badges: BadgeKind[] };

export const toCard = (s: CardRow): ServerCard => ({
  ...s,
  bumpedAt: s.bumpedAt ? s.bumpedAt.toISOString() : null,
  tags: s.tags.map((t) => t.tag.name),
  badges: sortBadges(s.badges.map((b) => b.kind)),
});

/** Listing is visible to the public on /view (unlisted ones too, via direct link). */
export const isViewable = (status: string) => status === 'PUBLIC' || status === 'UNLISTED';

export function canManageListing(user: SessionUser | null, server: { ownerId: string }) {
  return !!user && !user.bannedAt && (user.id === server.ownerId || isStaff(user));
}

export const inviteRe = /^https:\/\/(www\.)?(yapin\.gg|yapper\.website)\/(invite|i)\/[A-Za-z0-9_-]{2,64}\/?$/;

export const listingSchema = z.object({
  summary: z.string().trim().min(10, 'Give it at least 10 characters').max(140, 'Keep it under 140 characters'),
  description: z.string().trim().min(30, 'Tell people a bit more (30+ characters)').max(2000, 'Max 2000 characters'),
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
    .max(10)
    .transform(normalizeTags)
    .refine((t) => t.length >= 1, 'Add at least one tag')
    .refine((t) => t.length <= MAX_TAGS, `Up to ${MAX_TAGS} tags`),
});

export type ListingInput = z.infer<typeof listingSchema>;

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
export async function bumpServer(serverId: string, userId: string, source: 'bot' | 'web'): Promise<BumpResult> {
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
    await tx.bump.create({ data: { serverId, userId, source } });
    return tx.server.findUnique({ where: { id: serverId }, select: { bumpCount: true } });
  });
  if (!updated) return { ok: false, reason: 'cooldown' };
  return { ok: true, bumpCount: updated.bumpCount, nextAt: new Date(now + BUMP_COOLDOWN_MS).toISOString() };
}
