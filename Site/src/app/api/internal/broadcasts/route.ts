// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { claimBatch, recordResults, resultSchema } from '@/lib/broadcasts';
import { fail, isInternal, json, readJson } from '@/lib/http';

/**
 * The bot's end of global messages (src/lib/broadcasts.ts).
 *   GET  — claim the next batch, or { work: false } when there's nothing to send.
 *   POST — report what happened to a batch.
 */
export async function GET(req: NextRequest) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const batch = await claimBatch();
  if (!batch) return json({ work: false });
  return json({
    work: true,
    broadcastId: batch.broadcast.id,
    title: batch.broadcast.title,
    body: batch.broadcast.body,
    linkUrl: batch.broadcast.linkUrl,
    linkLabel: batch.broadcast.linkLabel,
    deliveries: batch.deliveries,
  });
}

export async function POST(req: NextRequest) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const parsed = resultSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Bad request', 422);
  await recordResults(parsed.data.broadcastId, parsed.data.results);
  return json({ ok: true });
}
