// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { clientIp, fail, json, rateLimit, requireUser } from '@/lib/http';
import { castVote } from '@/lib/votes';

/** Vote for a server. All the limits (cooldown, daily caps, networks, account age) are in castVote. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ serverId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { serverId } = await params;
  // Double clicks and scripts hammering the button: the real limits are per day, this is per moment.
  if (!rateLimit(`vote:${g.user.id}:${serverId}`, 1, 10_000) || !rateLimit(`vote-ip:${clientIp(req.headers)}`, 15, 60_000)) {
    return fail('Slow down a little', 429);
  }
  const r = await castVote(serverId, g.user.id, clientIp(req.headers));
  return r.ok ? json(r) : fail(r.error, r.status, r.nextAt ? { nextAt: r.nextAt } : undefined);
}
