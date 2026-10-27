// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { ABUSE_REASONS, REMOVAL_REASONS } from '@/lib/reports';
import { hasSupport } from '@/lib/badges';

const details = z.string().trim().min(10).max(1500);
const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ABUSE'), reason: z.enum(Object.keys(ABUSE_REASONS) as [string, ...string[]]), details }),
  z.object({ kind: z.literal('REMOVAL'), reason: z.enum(Object.keys(REMOVAL_REASONS) as [string, ...string[]]), details }),
]);

const SUPPORT_REFUSAL = 'That’s the official YapBoard support listing, so there’s nothing to report. Send a bug report or a suggestion from its page instead.';

/**
 * The same queue the other two boards use; the report points at a client (src/lib/reports.ts). This is the
 * route that matters most of the three: a client is a file people run, so "this download is malware" has to
 * reach staff quickly and from the page itself.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`report:${g.user.id}`, 8, 60 * 60_000)) return fail('You’ve sent a lot of reports. Try again later.', 429);
  const { clientId } = await params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Pick a reason and add a few words of detail', 422);

  const client = await db.clientListing.findUnique({ where: { id: clientId }, select: { id: true, badges: { select: { kind: true } } } });
  if (!client) return fail('Client not found', 404);
  if (hasSupport(client.badges.map((b) => b.kind))) return fail(SUPPORT_REFUSAL, 403);

  const dupe = await db.report.findFirst({ where: { clientId, reporterId: g.user.id, kind: parsed.data.kind, status: 'OPEN' }, select: { id: true } });
  if (dupe) return fail('You already have an open report for this client. Staff will get to it.', 409);

  const r = await db.report.create({ data: { ...parsed.data, clientId, reporterId: g.user.id } });
  return json({ id: r.id }, 201);
}
