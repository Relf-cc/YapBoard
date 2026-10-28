// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { sortBadges } from '@/lib/badges';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { json } from '@/lib/http';
import { handle } from '@/lib/platform';
import { isBotViewable } from '@/lib/bots';
import { isViewable } from '@/lib/servers';

type Ctx = { params: Promise<{ botId: string }> };

/** One bot's listing, for a `/botinfo` command - including where to send people for support. */
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(req, 'bots', async () => {
    const { botId } = await params;
    const b = await db.botListing.findUnique({
      where: { id: botId },
      select: {
        name: true,
        avatarUrl: true,
        summary: true,
        prefix: true,
        website: true,
        library: true,
        status: true,
        serverCount: true,
        inviteUrl: true,
        badges: { select: { kind: true } },
        tags: { select: { tag: { select: { name: true } } } },
        supportServer: { select: { id: true, name: true, status: true } },
      },
    });
    if (!b) return json({ listed: false, addUrl: `${env.siteUrl}/bots/add?bot=${botId}` });
    const support = b.supportServer && isViewable(b.supportServer.status) ? { id: b.supportServer.id, name: b.supportServer.name, url: `${env.siteUrl}/view/${b.supportServer.id}` } : null;
    return json({
      listed: true,
      id: botId,
      name: b.name,
      avatarUrl: b.avatarUrl,
      summary: b.summary,
      prefix: b.prefix,
      website: b.website,
      library: b.library,
      status: b.status,
      serverCount: b.serverCount,
      inviteUrl: b.inviteUrl,
      tags: b.tags.map((t) => t.tag.name),
      badges: sortBadges(b.badges.map((x) => x.kind)),
      supportServer: support,
      url: isBotViewable(b.status) ? `${env.siteUrl}/bots/${botId}` : null,
    });
  });
}
