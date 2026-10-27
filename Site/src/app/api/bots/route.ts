// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { botListingSchema, setBotTags } from '@/lib/bots';
import { db } from '@/lib/db';
import { botEnabled, env } from '@/lib/env';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { checkManager, fetchUser, MANAGE_ERRORS } from '@/lib/yapin';

const id = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'That doesn’t look like an ID');

const createSchema = botListingSchema.extend({
  botId: id,
  /** The bot's support server, which the lister has to run. That's how we check the bot is theirs. */
  supportServerId: id,
  // Only used in dev without a bot token, where nothing can be looked up.
  name: z.string().trim().min(2).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`bot:create:${g.user.id}`, 10, 60 * 60_000)) return fail('Slow down a little. Try again later.', 429);

  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Check the form', 422, { fields: z.flattenError(parsed.error).fieldErrors });
  const { botId, supportServerId, name: devName, tags, unlisted, ...data } = parsed.data;

  let name = devName ?? '';
  let avatarUrl: string | null = null;
  if (botEnabled()) {
    // Running the bot's support server is the proof that the bot is yours.
    const check = await checkManager(supportServerId, g.user.id);
    if (!check.ok) return fail(MANAGE_ERRORS[check.reason], 403, { reason: check.reason, fields: { supportServerId: [MANAGE_ERRORS[check.reason]] } });
    const profile = await fetchUser(botId);
    if (!profile) return fail('No Yapin’ account has that ID. Copy the bot’s own ID, not the server’s.', 404, { fields: { botId: ['We couldn’t find that bot on Yapin’'] } });
    name = profile.displayName || profile.username;
    avatarUrl = profile.avatarUrl;
  } else if (env.isProd) {
    // Without the bot token nothing can be checked, so nothing gets listed (dev only skips the check).
    return fail('Listing bots is switched off right now. Try again later.', 503);
  } else if (!name) {
    return fail('Bot name is required in dev mode', 422, { fields: { name: ['Give it a name'] } });
  }

  const existing = await db.botListing.findUnique({ where: { id: botId }, select: { ownerId: true, status: true } });
  if (existing?.status === 'REMOVED') return fail('This bot was removed by YapBoard staff and can’t be listed again.', 403);
  if (existing) {
    return fail(
      existing.ownerId === g.user.id ? 'You’ve already listed this bot.' : 'Someone else already listed this bot. If you run it, send a removal request from its page.',
      409,
      { botId },
    );
  }

  // Link to the support server's own listing when it has one; otherwise just remember the id isn't on the board.
  const listedSupport = await db.server.findUnique({ where: { id: supportServerId }, select: { id: true } });

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.botListing.create({
      data: {
        id: botId,
        name,
        avatarUrl,
        ...data,
        supportServerId: listedSupport?.id ?? null,
        status: unlisted ? 'UNLISTED' : 'PUBLIC',
        ownerId: g.user.id,
        bumpedAt: now,
      },
    });
    await setBotTags(tx, botId, tags);
  });
  return json({ id: botId }, 201);
}
