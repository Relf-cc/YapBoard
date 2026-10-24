import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { botEnabled } from '@/lib/env';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { listingSchema, setTags } from '@/lib/servers';
import { checkManager, MANAGE_ERRORS } from '@/lib/yapin';

const createSchema = listingSchema.extend({
  serverId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'That doesn’t look like a server ID'),
  // Only used in dev without a bot token, where we can't look the server up.
  name: z.string().trim().min(2).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`create:${g.user.id}`, 10, 60 * 60_000)) return fail('Slow down a little. Try again later.', 429);

  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Check the form', 422, { fields: z.flattenError(parsed.error).fieldErrors });
  const { serverId, name: devName, tags, unlisted, ...data } = parsed.data;

  let name = devName ?? '';
  let iconUrl: string | null = null;
  let bannerUrl: string | null = null;
  if (botEnabled()) {
    const check = await checkManager(serverId, g.user.id);
    if (!check.ok) return fail(MANAGE_ERRORS[check.reason], 403, { reason: check.reason });
    ({ name, iconUrl, bannerUrl } = check.server);
  } else if (!name) {
    return fail('Server name is required in dev mode', 422, { fields: { name: ['Give it a name'] } });
  }

  const existing = await db.server.findUnique({ where: { id: serverId }, select: { ownerId: true, status: true } });
  if (existing?.status === 'REMOVED') return fail('This server was removed by YapBoard staff and can’t be listed again.', 403);
  if (existing) {
    return fail(
      existing.ownerId === g.user.id
        ? 'You’ve already listed this server.'
        : 'Someone else already listed this server. If you run it, send a removal request from its page.',
      409,
      { serverId },
    );
  }

  await db.$transaction(async (tx) => {
    await tx.server.create({
      data: { id: serverId, name, iconUrl, bannerUrl, ...data, status: unlisted ? 'UNLISTED' : 'PUBLIC', ownerId: g.user.id, bumpedAt: new Date() },
    });
    await setTags(tx, serverId, tags);
  });
  return json({ id: serverId }, 201);
}
