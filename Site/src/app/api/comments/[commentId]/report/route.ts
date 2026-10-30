// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { locate } from '@/lib/comments';
import { db } from '@/lib/db';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { ABUSE_REASONS } from '@/lib/reports';

const schema = z.object({
  reason: z.enum(Object.keys(ABUSE_REASONS) as [string, ...string[]]),
  details: z.string().trim().min(10).max(1500),
});

/**
 * Report something somebody wrote.
 *
 * This is the whole answer to "an owner can't hide a review of their listing" - they can report it, and a
 * staff member decides, with an audit trail, like every other removal here. It lands in the queue that
 * already exists: the report carries both the comment and the listing it was written under, so the portal
 * can group it by board and read it in context without a second lookup.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`report:${g.user.id}`, 8, 60 * 60_000)) return fail('You’ve sent a lot of reports. Try again later.', 429);
  const { commentId } = await params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Pick a reason and add a few words of detail', 422);

  const comment = await db.comment.findUnique({ where: { id: commentId }, select: { id: true, userId: true, serverId: true, botId: true, clientId: true } });
  if (!comment) return fail('That comment isn’t there any more', 404);
  if (comment.userId === g.user.id) return fail('That’s your own comment. Edit or hide it instead.', 400);

  const dupe = await db.report.findFirst({ where: { commentId, reporterId: g.user.id, status: 'OPEN' }, select: { id: true } });
  if (dupe) return fail('You already have an open report for this. Staff will get to it.', 409);

  const { kind, listingId } = locate(comment);
  const r = await db.report.create({
    data: {
      kind: 'ABUSE',
      reason: parsed.data.reason,
      details: parsed.data.details,
      commentId,
      [kind === 'server' ? 'serverId' : kind === 'bot' ? 'botId' : 'clientId']: listingId,
      reporterId: g.user.id,
    },
  });
  return json({ id: r.id }, 201);
}
