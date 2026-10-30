// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, isInternal, json, readJson } from '@/lib/http';
import { reviewDigest } from '@/lib/review-digest';
import { bumpServer } from '@/lib/servers';

const schema = z.object({
  serverId: z.string().min(1).max(64),
  userId: z.string().min(1).max(64),
  username: z.string().min(1).max(64),
  displayName: z.string().max(100).nullish(),
  avatarUrl: z.string().url().max(500).nullish(),
  memberCount: z.number().int().min(0).optional(),
  /// Where /bump was typed. Global messages from staff go back to this channel (src/lib/broadcasts.ts).
  channelId: z.string().min(1).max(64).optional(),
});

/** Called by the bot when someone types /bump in their server. */
export async function POST(req: NextRequest) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Bad request', 422);
  const { serverId, userId, username, displayName, avatarUrl, memberCount, channelId } = parsed.data;

  // People can bump without ever logging in on the site, so make sure they exist.
  const user = await db.user.upsert({
    where: { id: userId },
    create: { id: userId, username, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null },
    update: {},
    select: { bannedAt: true },
  });
  if (user.bannedAt) return json({ ok: false, reason: 'banned' });

  const server = await db.server.findUnique({ where: { id: serverId }, select: { name: true, iconUrl: true, accent: true, bumpedAt: true } });
  // Read before the bump, so "since your last bump" means since the *previous* one rather than since now.
  const reviews = server ? await reviewDigest('server', serverId, server.bumpedAt) : null;
  const result = await bumpServer(serverId, userId, 'bot');
  // The channel is worth keeping even when the bump itself was too soon: it's still where people talk to us.
  const fresh = { ...(memberCount !== undefined && { memberCount }), ...(channelId && { bumpChannelId: channelId, bumpChannelAt: new Date() }) };
  if (server && Object.keys(fresh).length) await db.server.update({ where: { id: serverId }, data: fresh });
  return json({
    ...result,
    name: server?.name ?? null,
    iconUrl: server?.iconUrl ?? null,
    accent: server?.accent ?? null,
    reviews,
    url: `${env.siteUrl}/view/${serverId}`,
    addUrl: `${env.siteUrl}/add?server=${serverId}`,
  });
}
