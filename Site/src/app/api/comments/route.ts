// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { postComment, postSchema } from '@/lib/comments';
import { clientIp, fail, json, rateLimit, readJson, requireUser } from '@/lib/http';

/**
 * Write a review or a reply. One route for all three boards, because the board is a field on the row.
 *
 * Every real limit - account age, per-day caps, per-network caps, the cooldown, one review per listing -
 * lives in `postComment`, so the bot and anything else that ever posts goes through the same rules. What is
 * here is only the per-moment guard against a double click or a script with a loop in it.
 */
export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`comment:${g.user.id}`, 3, 20_000) || !rateLimit(`comment-ip:${clientIp(req.headers)}`, 20, 60_000)) {
    return fail('Slow down a little', 429);
  }
  const parsed = postSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check what you’ve written', 422);

  const r = await postComment(parsed.data, g.user.id, clientIp(req.headers));
  return r.ok ? json({ id: r.id }, 201) : fail(r.error, r.status);
}
