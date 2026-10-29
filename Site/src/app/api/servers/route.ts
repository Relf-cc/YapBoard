// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { botEnabled, env } from '@/lib/env';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { checkListingExtras, listingData, listingSchema, setTags } from '@/lib/servers';
import { limitsFor } from '@/lib/pro';
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
  const problem = checkListingExtras(parsed.data);
  if (problem) return fail('Check the form', 422, { fields: { [problem.field]: [problem.message] } });

  // serverId and name are columns this route sets itself, below, so they're kept out of `listingData`.
  const { serverId, name: devName, ...listing } = parsed.data;
  const { tags, unlisted } = listing;
  // A server that doesn't exist yet can't be covered by a plan, so it's created on the free caps and the
  // owner points a slot at it afterwards (POST /api/billing/slots).
  const data = listingData(listing, limitsFor('server', false));

  let name = devName ?? '';
  let iconUrl: string | null = null;
  let bannerUrl: string | null = null;
  let memberCount: number | null = null;
  if (botEnabled()) {
    const check = await checkManager(serverId, g.user.id);
    if (!check.ok) return fail(MANAGE_ERRORS[check.reason], 403, { reason: check.reason });
    ({ name, iconUrl, bannerUrl, memberCount } = check.server);
  } else if (env.isProd) {
    // Without the bot token nobody can be checked, so nobody gets to list anything (dev only skips the check).
    return fail('Adding servers is switched off right now. Try again later.', 503);
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

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.server.create({
      // The count comes along with the manager check, so a new listing doesn't show 0 until the bot's next sync.
      data: { id: serverId, name, iconUrl, bannerUrl, ...(memberCount !== null && { memberCount }), ...data, status: unlisted ? 'UNLISTED' : 'PUBLIC', ownerId: g.user.id, bumpedAt: now, rankedAt: now },
    });
    await setTags(tx, serverId, tags);
  });
  return json({ id: serverId }, 201);
}
