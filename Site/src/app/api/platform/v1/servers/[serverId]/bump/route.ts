// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, json, readJson } from '@/lib/http';
import { callerSchema, handle, upsertCaller } from '@/lib/platform';
import { bumpServer } from '@/lib/servers';

type Ctx = { params: Promise<{ serverId: string }> };

const schema = z.object({
  user: callerSchema,
  memberCount: z.number().int().min(0).optional(),
  /// Where it was typed. Kept for the same reason the bot keeps it: it's where staff's global messages go back to.
  channelId: z.string().min(1).max(64).optional(),
});

/**
 * A server bump from a member's bot. The same call YapBoard's own /bump makes (src/app/api/internal/bump),
 * with two differences: a key stands in for the shared internal secret, and the bump records the app as well
 * as the person, so a listing's history says which bot carried it.
 *
 * Anyone in a server may bump it — that's the rule on the site too, and the cooldown is the listing's, not
 * the person's. A bump that's turned down (cooldown, not listed, banned) is a 200 with `ok: false`: it isn't
 * the caller's mistake, and making it an error would have every integration treat "wait two hours" as a bug.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(req, 'bump.servers', async (app) => {
    const { serverId } = await params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail('Bad request', 422);
    const { user, memberCount, channelId } = parsed.data;

    const { banned } = await upsertCaller(user);
    if (banned) return json({ ok: false, reason: 'banned' });

    const server = await db.server.findUnique({ where: { id: serverId }, select: { name: true, iconUrl: true, accent: true } });
    const result = await bumpServer(serverId, user.id, 'bot');
    // The channel is worth keeping even when the bump itself was too soon: it's still where people talk to us.
    const fresh = { ...(memberCount !== undefined && { memberCount }), ...(channelId && { bumpChannelId: channelId, bumpChannelAt: new Date() }) };
    if (server && Object.keys(fresh).length) await db.server.update({ where: { id: serverId }, data: fresh });

    return json({
      ...result,
      board: 'servers',
      server: server && { id: serverId, name: server.name, iconUrl: server.iconUrl, accent: server.accent },
      url: `${env.siteUrl}/view/${serverId}`,
      addUrl: `${env.siteUrl}/add?server=${serverId}`,
      via: { appId: app.id, botId: app.botId },
    });
  });
}
