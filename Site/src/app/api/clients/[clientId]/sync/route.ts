// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { canManageClient, syncClientRelease } from '@/lib/clients';
import { db } from '@/lib/db';
import { RELEASE_ERRORS } from '@/lib/github';
import { fail, json, rateLimit, requireUser } from '@/lib/http';

/**
 * "Check for a new release" on the manage page. Pages refresh themselves in the background when their release
 * is stale, so this is for the moment right after publishing one, when waiting half an hour isn't the answer.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { clientId } = await params;
  const client = await db.clientListing.findUnique({ where: { id: clientId }, select: { ownerId: true, releaseSource: true, repo: true } });
  if (!client || !canManageClient(g.user, client)) return fail('Not found', 404);
  if (client.releaseSource !== 'GITHUB' || !client.repo) return fail('This listing keeps its own download links, so there’s nothing to sync.', 400);
  // GitHub rate-limits us, not them, so the button is limited before it reaches GitHub.
  if (!rateLimit(`client:sync:${clientId}`, 10, 10 * 60_000)) return fail('You’ve just checked. Give it a few minutes.', 429);

  const r = await syncClientRelease(clientId);
  if (!r.ok) return fail(RELEASE_ERRORS[r.reason] ?? 'Couldn’t read that release.', 502, { reason: r.reason });
  return json(r);
}
