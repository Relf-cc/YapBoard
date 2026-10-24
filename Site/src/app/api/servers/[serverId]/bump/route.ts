import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { botEnabled } from '@/lib/env';
import { fail, json, requireUser } from '@/lib/http';
import { bumpServer, canManageListing } from '@/lib/servers';

/** Bumping from the website is only for local dev; with the bot configured, bumps come from /bump in the server. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ serverId: string }> }) {
  if (botEnabled()) return fail('Bump from your server with /bump', 400);
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { serverId } = await params;
  const server = await db.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  if (!server || !canManageListing(g.user, server)) return fail('Not found', 404);
  const r = await bumpServer(serverId, g.user.id, 'web');
  return r.ok ? json(r) : fail(r.reason === 'cooldown' ? 'Still cooling down' : 'Can’t bump this server', 429, r);
}
