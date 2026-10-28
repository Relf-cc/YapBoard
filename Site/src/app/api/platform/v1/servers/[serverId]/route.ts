// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { sortBadges } from '@/lib/badges';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { json } from '@/lib/http';
import { handle } from '@/lib/platform';
import { BUMP_COOLDOWN_MS, isViewable } from '@/lib/servers';

type Ctx = { params: Promise<{ serverId: string }> };

/**
 * One server's listing, for a member's `/yapboard`-style command.
 *
 * A hidden or removed listing answers `listed: true` with that status and no `url`: "this server is listed
 * but you can't see it" is true, and "this server isn't listed" is not - the owner needs to be told which.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(req, 'listing', async () => {
    const { serverId } = await params;
    const s = await db.server.findUnique({
      where: { id: serverId },
      select: {
        name: true,
        iconUrl: true,
        summary: true,
        accent: true,
        status: true,
        bumpCount: true,
        bumpedAt: true,
        memberCount: true,
        views: true,
        joins: true,
        badges: { select: { kind: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });
    if (!s) return json({ listed: false, addUrl: `${env.siteUrl}/add?server=${serverId}` });
    return json({
      listed: true,
      id: serverId,
      name: s.name,
      iconUrl: s.iconUrl,
      summary: s.summary,
      accent: s.accent,
      status: s.status,
      bumpCount: s.bumpCount,
      bumpedAt: s.bumpedAt,
      nextBumpAt: s.bumpedAt ? new Date(s.bumpedAt.getTime() + BUMP_COOLDOWN_MS).toISOString() : null,
      memberCount: s.memberCount,
      views: s.views,
      joins: s.joins,
      tags: s.tags.map((t) => t.tag.name),
      badges: sortBadges(s.badges.map((b) => b.kind)),
      url: isViewable(s.status) ? `${env.siteUrl}/view/${serverId}` : null,
    });
  });
}
