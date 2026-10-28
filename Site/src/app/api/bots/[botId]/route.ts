// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { approvedStatus, botListingSchema, canManageBot, isOwnerEditable, setBotTags } from '@/lib/bots';
import { db } from '@/lib/db';
import { fail, json, readJson, requireUser } from '@/lib/http';
import { isStaff } from '@/lib/session';
import { botEnabled } from '@/lib/env';
import { checkManager, isMember, MANAGE_ERRORS } from '@/lib/yapin';

type Ctx = { params: Promise<{ botId: string }> };

async function loadManaged(req: NextRequest, ctx: Ctx) {
  const g = await requireUser(req);
  if (g.error) return { error: g.error };
  const { botId } = await ctx.params;
  const bot = await db.botListing.findUnique({ where: { id: botId }, select: { id: true, ownerId: true, status: true, supportServerId: true, requestedUnlisted: true } });
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
  /** Swapping the support server swaps the proof the bot is yours, so it is re-checked and re-reviewed. */
  let supportChanged = false;
  if (supportServerId !== undefined) {
    const next = supportServerId || null;
    supportChanged = next !== m.bot.supportServerId;
    if (!next) support = { supportServerId: null };
    else {
      const s = await db.server.findUnique({ where: { id: supportServerId }, select: { id: true } });
      if (!s) return fail('Check the form', 422, { fields: { supportServerId: ['That server isn’t listed on YapBoard yet'] } });
      /**
       * This used to accept any listed server, so a listing could be pointed at a stranger's. Naming a server
       * as a bot's support server is the whole ownership claim, so it has to be one this person runs - the same
       * check POST /api/bots makes. Staff can move a listing anywhere.
       */
      if (supportChanged && !isStaff(m.user) && botEnabled()) {
        const check = await checkManager(s.id, m.user.id);
        if (!check.ok) return fail(MANAGE_ERRORS[check.reason], 403, { reason: check.reason, fields: { supportServerId: [MANAGE_ERRORS[check.reason]] } });
        if ((await isMember(s.id, m.bot.id)) === false) {
          return fail('That bot isn’t in that server. Add it there first.', 422, { fields: { supportServerId: ['The bot isn’t in that server'] } });
        }
      }
      support = { supportServerId: s.id };
    }
  }

  /**
   * Editing a denied listing is how it gets resubmitted, and changing the support server sends an approved one
   * back to the queue. Otherwise edits go straight out, and staff decisions (HIDDEN/REMOVED) stay put.
   */
  const status = !isOwnerEditable(m.bot.status)
    ? m.bot.status
    : m.bot.status === 'DENIED' || m.bot.status === 'PENDING' || supportChanged
      ? 'PENDING'
      : approvedStatus(unlisted);

  const backToQueue = status === 'PENDING' && m.bot.status !== 'PENDING';
  await db.$transaction(async (tx) => {
    await tx.botListing.update({
      where: { id: m.bot.id },
      // While it's queued, `unlisted` is a request rather than a live setting (lib/bots.ts approvedStatus).
      data: { ...data, ...support, status, requestedUnlisted: unlisted, ...(backToQueue ? { statusNote: null, reviewedAt: null, reviewedById: null } : {}) },
    });
    await setBotTags(tx, m.bot.id, tags);
  });
  return json({ ok: true, status, inReview: status === 'PENDING' });
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
