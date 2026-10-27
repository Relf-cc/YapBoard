// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { bumpClient, canManageClient } from '@/lib/clients';
import { db } from '@/lib/db';
import { fail, json, requireUser } from '@/lib/http';

/** Clients bump from the site, like bots: there's nothing to type `/bump` into. Same 2 hour cooldown. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { clientId } = await params;
  const client = await db.clientListing.findUnique({ where: { id: clientId }, select: { ownerId: true } });
  if (!client || !canManageClient(g.user, client)) return fail('Not found', 404);
  const r = await bumpClient(clientId, g.user.id);
  return r.ok ? json(r) : fail(r.reason === 'cooldown' ? 'Still cooling down' : 'Can’t bump this client', 429, r);
}
