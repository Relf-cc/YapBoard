// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { sortBadges } from '@/lib/badges';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, isInternal, json, readJson } from '@/lib/http';
import { reviewDigest } from '@/lib/review-digest';
import { BUMP_COOLDOWN_MS } from '@/lib/servers';

type Ctx = { params: Promise<{ serverId: string }> };

/** Listing info for the bot's /yapboard command. */
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const { serverId } = await params;
  const s = await db.server.findUnique({
    where: { id: serverId },
    select: { name: true, iconUrl: true, summary: true, accent: true, badges: { select: { kind: true } }, status: true, bumpCount: true, bumpedAt: true, memberCount: true, views: true, joins: true, tags: { select: { tag: { select: { name: true } } } } },
  });
  if (!s) return json({ listed: false, addUrl: `${env.siteUrl}/add?server=${serverId}` });
  // One line the bot can put on a message it was already sending - see src/lib/review-digest.ts.
  const reviews = await reviewDigest('server', serverId, s.bumpedAt);
  return json({
    listed: true,
    ...s,
    reviews,
    tags: s.tags.map((t) => t.tag.name),
    badges: sortBadges(s.badges.map((b) => b.kind)),
    nextBumpAt: s.bumpedAt ? new Date(s.bumpedAt.getTime() + BUMP_COOLDOWN_MS).toISOString() : null,
    url: `${env.siteUrl}/view/${serverId}`,
    manageUrl: `${env.siteUrl}/manage/${serverId}`,
  });
}

const patch = z.object({
  memberCount: z.number().int().min(0).optional(),
  name: z.string().min(1).max(100).optional(),
  iconUrl: z.string().url().max(500).nullable().optional(),
});

/** The bot keeps member counts (and name/icon) fresh. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const { serverId } = await params;
  const parsed = patch.safeParse(await readJson(req));
  if (!parsed.success) return fail('Bad request', 422);
  const res = await db.server.updateMany({ where: { id: serverId }, data: parsed.data });
  return json({ updated: res.count > 0 });
}
