// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { bumpBot } from '@/lib/bots';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, json, readJson } from '@/lib/http';
import { callerSchema, handle, serverIsHome, upsertCaller } from '@/lib/platform';

type Ctx = { params: Promise<{ botId: string }> };

const schema = z.object({
  user: callerSchema,
  /// The server the command was typed in. Required: it's what decides whether this bot may be bumped here.
  serverId: z.string().min(1).max(64),
});

/**
 * A bot bump from a member's bot. Same two-hour cooldown as every other board (src/lib/bots.ts).
 *
 * A bot may only be bumped from a server it belongs to — its support server, or a server its lister owns.
 * Without that, a single busy server could push a whole shelf of other people's bots up the board, which is
 * exactly backwards: a bump is meant to say "the people here use this", not "this bot has one loud server".
 * `serverIsHome` in src/lib/platform.ts is the check; anywhere else answers `wrong_server`.
 *
 * Anyone in that server may do it, as with a server bump — the gate is the server, not the person. The
 * cooldown belongs to the listing, so one home server can't bump faster than the lister could themselves.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(req, 'bump.bots', async (app) => {
    const { botId } = await params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail('Send `user` and the `serverId` the command was typed in', 422);
    const { user, serverId } = parsed.data;

    const { banned } = await upsertCaller(user);
    if (banned) return json({ ok: false, reason: 'banned' });

    const bot = await db.botListing.findUnique({
      where: { id: botId },
      select: { name: true, avatarUrl: true, accent: true, ownerId: true, supportServerId: true },
    });
    if (!bot) return json({ ok: false, reason: 'not_found', addUrl: `${env.siteUrl}/bots/add?bot=${botId}` });

    if (!(await serverIsHome(serverId, bot))) {
      return json({
        ok: false,
        reason: 'wrong_server',
        board: 'bots',
        // Said plainly, because the fix is on the listing, not in the caller's code.
        detail: 'This bot can only be bumped from its support server, or from a server its lister owns. The lister can set its support server on the listing.',
        url: `${env.siteUrl}/bots/${botId}`,
      });
    }

    const result = await bumpBot(botId, user.id, app.id);
    return json({
      ...result,
      board: 'bots',
      bot: { id: botId, name: bot.name, avatarUrl: bot.avatarUrl, accent: bot.accent },
      url: `${env.siteUrl}/bots/${botId}`,
      via: { appId: app.id, botId: app.botId, serverId },
    });
  });
}
