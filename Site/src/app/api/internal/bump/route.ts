import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, isInternal, json } from '@/lib/http';
import { bumpServer } from '@/lib/servers';

const schema = z.object({
  serverId: z.string().min(1).max(64),
  userId: z.string().min(1).max(64),
  username: z.string().min(1).max(64),
  displayName: z.string().max(100).nullish(),
  avatarUrl: z.string().url().max(500).nullish(),
  memberCount: z.number().int().min(0).optional(),
});

/** Called by the bot when someone types /bump in their server. */
export async function POST(req: NextRequest) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Bad request', 422);
  const { serverId, userId, username, displayName, avatarUrl, memberCount } = parsed.data;

  // People can bump without ever logging in on the site, so make sure they exist.
  const user = await db.user.upsert({
    where: { id: userId },
    create: { id: userId, username, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null },
    update: {},
    select: { bannedAt: true },
  });
  if (user.bannedAt) return json({ ok: false, reason: 'banned' });

  const server = await db.server.findUnique({ where: { id: serverId }, select: { name: true, iconUrl: true, accent: true } });
  const result = await bumpServer(serverId, userId, 'bot');
  if (memberCount !== undefined && server) await db.server.update({ where: { id: serverId }, data: { memberCount } });
  return json({
    ...result,
    name: server?.name ?? null,
    iconUrl: server?.iconUrl ?? null,
    accent: server?.accent ?? null,
    url: `${env.siteUrl}/view/${serverId}`,
    addUrl: `${env.siteUrl}/add?server=${serverId}`,
  });
}
