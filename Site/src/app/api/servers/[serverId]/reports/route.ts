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

/** Said to anyone trying to report the official support listing. */
const SUPPORT_REFUSAL = 'That’s the official YapBoard support listing, so there’s nothing to report. Send a bug report or a suggestion from its page instead.';

export async function POST(req: NextRequest, { params }: { params: Promise<{ serverId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`report:${g.user.id}`, 8, 60 * 60_000)) return fail('You’ve sent a lot of reports. Try again later.', 429);
  const { serverId } = await params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Pick a reason and add a few words of detail', 422);

  const server = await db.server.findUnique({ where: { id: serverId }, select: { id: true, badges: { select: { kind: true } } } });
  if (!server) return fail('Server not found', 404);
  // Staff's own support server isn't reportable; the listing page offers a bug report or a suggestion instead.
  if (hasSupport(server.badges.map((b) => b.kind))) return fail(SUPPORT_REFUSAL, 403);

  const dupe = await db.report.findFirst({ where: { serverId, reporterId: g.user.id, kind: parsed.data.kind, status: 'OPEN' }, select: { id: true } });
  if (dupe) return fail('You already have an open report for this server. Staff will get to it.', 409);

  const r = await db.report.create({ data: { ...parsed.data, serverId, reporterId: g.user.id } });
  return json({ id: r.id }, 201);
}
