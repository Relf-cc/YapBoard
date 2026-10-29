// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { bumpBot, canManageBot } from '@/lib/bots';
import { db } from '@/lib/db';
import { fail, json, requireUser } from '@/lib/http';

/**
 * Bots bump from the site: a bot can't type /bump about itself, so its lister presses the button instead.
 * Same 2 hour cooldown as servers (src/lib/bots.ts).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { botId } = await params;
  const bot = await db.botListing.findUnique({ where: { id: botId }, select: { ownerId: true, managers: { select: { userId: true } } } });
  if (!bot || !canManageBot(g.user, bot)) return fail('Not found', 404);
  const r = await bumpBot(botId, g.user.id);
  return r.ok ? json(r) : fail(r.reason === 'cooldown' ? 'Still cooling down' : 'Can’t bump this bot', 429, r);
}
