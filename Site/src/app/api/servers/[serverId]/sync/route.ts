// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { botEnabled } from '@/lib/env';
import { fail, json, rateLimit, requireUser } from '@/lib/http';
import { canManageListing } from '@/lib/servers';
import { fetchServer } from '@/lib/yapin';

/** Pull the latest name, icon and member count from Yapin'. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ serverId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { serverId } = await params;
  const server = await db.server.findUnique({ where: { id: serverId }, select: { ownerId: true, managers: { select: { userId: true } } } });
  if (!server || !canManageListing(g.user, server)) return fail('Not found', 404);
  if (!botEnabled()) return fail('Syncing needs the bot token (YAPPER_BOT_TOKEN)', 400);
  if (!rateLimit(`sync:${serverId}`, 5, 10 * 60_000)) return fail('Synced recently, try again in a few minutes', 429);
  const live = await fetchServer(serverId);
  if (!live) return fail('YapBoard’s bot isn’t in that server any more', 404);
  const updated = await db.server.update({
    where: { id: serverId },
    data: { name: live.name, iconUrl: live.iconUrl, bannerUrl: live.bannerUrl, ...(live.memberCount !== null && { memberCount: live.memberCount }) },
    select: { name: true, iconUrl: true, memberCount: true },
  });
  return json(updated);
}
