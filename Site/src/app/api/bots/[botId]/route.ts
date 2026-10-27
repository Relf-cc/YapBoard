// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { botListingSchema, canManageBot, setBotTags } from '@/lib/bots';
import { db } from '@/lib/db';
import { fail, json, readJson, requireUser } from '@/lib/http';
import { isStaff } from '@/lib/session';

type Ctx = { params: Promise<{ botId: string }> };

async function loadManaged(req: NextRequest, ctx: Ctx) {
  const g = await requireUser(req);
  if (g.error) return { error: g.error };
  const { botId } = await ctx.params;
  const bot = await db.botListing.findUnique({ where: { id: botId }, select: { id: true, ownerId: true, status: true } });
  if (!bot) return { error: fail('Not found', 404) };
  if (!canManageBot(g.user, bot)) return { error: fail('You can’t edit this listing', 403) };
  return { user: g.user, bot };
}

const patchSchema = botListingSchema.extend({
  /** Changing which server supports the bot. '' unlinks it. Only servers listed here can be linked. */
  supportServerId: z.string().trim().max(64).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const m = await loadManaged(req, ctx);
  if (m.error) return m.error;
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Check the form', 422, { fields: z.flattenError(parsed.error).fieldErrors });
  const { tags, unlisted, supportServerId, ...data } = parsed.data;

  let support: { supportServerId?: string | null } = {};
  if (supportServerId !== undefined) {
    if (!supportServerId) support = { supportServerId: null };
    else {
      const s = await db.server.findUnique({ where: { id: supportServerId }, select: { id: true } });
      if (!s) return fail('Check the form', 422, { fields: { supportServerId: ['That server isn’t listed on YapBoard yet'] } });
      support = { supportServerId: s.id };
    }
  }

  // Owners can flip public/unlisted; staff decisions (HIDDEN/REMOVED) stay put.
  const status = m.bot.status === 'PUBLIC' || m.bot.status === 'UNLISTED' ? (unlisted ? 'UNLISTED' : 'PUBLIC') : m.bot.status;
  await db.$transaction(async (tx) => {
    await tx.botListing.update({ where: { id: m.bot.id }, data: { ...data, ...support, status } });
    await setBotTags(tx, m.bot.id, tags);
  });
  return json({ ok: true, status });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const m = await loadManaged(req, ctx);
  if (m.error) return m.error;
  // A staff-removed listing stays as a tombstone so it can't simply be re-added.
  if (m.bot.status === 'REMOVED') return fail('This listing was removed by staff', 403);
  if (!isStaff(m.user)) {
    if (m.bot.status === 'HIDDEN') return fail('YapBoard staff hid this listing, so it can’t be deleted. Contact us if you think that’s a mistake.', 403);
    const open = await db.report.count({ where: { botId: m.bot.id, status: 'OPEN' } });
    if (open) return fail('This listing has a report waiting for YapBoard staff. You can delete it once they’ve looked at it.', 409);
  }
  await db.botListing.delete({ where: { id: m.bot.id } });
  return json({ ok: true });
}
