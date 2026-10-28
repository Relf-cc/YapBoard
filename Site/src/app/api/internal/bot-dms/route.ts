// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { claimDmBatch, dmResultSchema, recordDmResults } from '@/lib/bot-dms';
import { fail, isInternal, json, readJson } from '@/lib/http';

/**
 * The bot's end of review-decision DMs (src/lib/bot-dms.ts).
 *   GET  - claim the next batch, or { work: false } when there's nothing to send.
 *   POST - report what happened to a batch.
 */
export async function GET(req: NextRequest) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const dms = await claimDmBatch();
  if (!dms.length) return json({ work: false });
  return json({ work: true, dms });
}

export async function POST(req: NextRequest) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const parsed = dmResultSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Bad request', 422);
  await recordDmResults(parsed.data.results);
  return json({ ok: true });
}
