// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { bumpClient } from '@/lib/clients';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, json, readJson } from '@/lib/http';
import { callerSchema, handle, serverIsHome, upsertCaller } from '@/lib/platform';

type Ctx = { params: Promise<{ client: string }> };

const schema = z.object({
  user: callerSchema,
  /// The server the command was typed in. Required, for the same reason bot bumps require it.
  serverId: z.string().min(1).max(64),
});

/**
 * A client bump from a member's bot. Same two-hour cooldown as the other boards (src/lib/clients.ts).
 *
 * The path takes either the client's id or its slug — a client has no Yapin' id of its own, and the slug is
 * what search hands back and what its URL uses, so asking a developer to carry a cuid as well would be
 * busywork.
 *
 * Same home-server rule as bots: the bump has to come from the client's support server, or from a server its
 * lister owns. A client lives outside Yapin' entirely, so its support server is the only community there is
 * to vouch for it.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(req, 'bump.clients', async (app) => {
    const { client: key } = await params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return fail('Send `user` and the `serverId` the command was typed in', 422);
    const { user, serverId } = parsed.data;

    const { banned } = await upsertCaller(user);
    if (banned) return json({ ok: false, reason: 'banned' });

    const client = await db.clientListing.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      select: { id: true, slug: true, name: true, iconUrl: true, accent: true, ownerId: true, supportServerId: true },
    });
    if (!client) return json({ ok: false, reason: 'not_found', addUrl: `${env.siteUrl}/clients/add` });

    if (!(await serverIsHome(serverId, client))) {
      return json({
        ok: false,
        reason: 'wrong_server',
        board: 'clients',
        detail: 'This client can only be bumped from its support server, or from a server its lister owns. The lister can set its support server on the listing.',
        url: `${env.siteUrl}/clients/${client.slug}`,
      });
    }

    const result = await bumpClient(client.id, user.id, app.id);
    return json({
      ...result,
      board: 'clients',
      client: { id: client.id, slug: client.slug, name: client.name, iconUrl: client.iconUrl, accent: client.accent },
      url: `${env.siteUrl}/clients/${client.slug}`,
      via: { appId: app.id, botId: app.botId, serverId },
    });
  });
}
