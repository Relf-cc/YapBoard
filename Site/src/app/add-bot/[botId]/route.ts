// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { NextResponse, type NextRequest } from 'next/server';
import { isBotViewable } from '@/lib/bots';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { countOnce } from '@/lib/http';

/**
 * Counts the click on "Add to your server", then sends people to the bot's own page when it has one.
 * Bots without a link have nowhere to send anyone - they're added by pasting the id - so that goes back to
 * the listing, where the id sits in a copy box.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const b = await db.botListing.findUnique({ where: { id: botId }, select: { inviteUrl: true, status: true } });
  if (!b || !isBotViewable(b.status)) return NextResponse.redirect(new URL('/bots', env.siteUrl));
  if (countOnce('join', `bot:${botId}`, req.headers)) await db.botListing.update({ where: { id: botId }, data: { adds: { increment: 1 } } }).catch(() => {});
  // Checked again here, so a bad row can never turn this into an open redirect.
  const safe = b.inviteUrl && /^https:\/\/\S+$/.test(b.inviteUrl) ? b.inviteUrl : null;
  return NextResponse.redirect(safe ?? new URL(`/bots/${encodeURIComponent(botId)}`, env.siteUrl));
}
