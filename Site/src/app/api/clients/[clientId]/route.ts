// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  approvedClientStatus,
  canManageClient,
  checkReleaseSetup,
  clientListingSchemaFor,
  isClientOwnerEditable,
  setClientTags,
  setManualFiles,
  syncClientRelease,
} from '@/lib/clients';
import { db } from '@/lib/db';
import { parseRepo } from '@/lib/github';
import { fail, json, readJson, requireUser } from '@/lib/http';
import { grandfather, limitsOf, releaseSlot } from '@/lib/pro';
import { isOwner } from '@/lib/manage';
import { isStaff } from '@/lib/session';

type Ctx = { params: Promise<{ clientId: string }> };

async function loadManaged(req: NextRequest, ctx: Ctx) {
  const g = await requireUser(req);
  if (g.error) return { error: g.error };
  const { clientId } = await ctx.params;
  const client = await db.clientListing.findUnique({
    where: { id: clientId },
    // description and the tag count come along for `grandfather`: a lapsed listing must still be editable.
    select: { id: true, slug: true, ownerId: true, status: true, repo: true, releaseSource: true, description: true, _count: { select: { tags: true } }, managers: { select: { userId: true } } },
  });
  if (!client) return { error: fail('Not found', 404) };
  if (!canManageClient(g.user, client)) return { error: fail('You can’t edit this listing', 403) };
  return { user: g.user, client };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const m = await loadManaged(req, ctx);
  if (m.error) return m.error;
  // What this listing may contain depends on whether a Pro plan covers it (src/lib/pro.ts).
  const limits = grandfather(await limitsOf('client', m.client.id, m.client.ownerId), {
    description: m.client.description.length,
    tags: m.client._count.tags,
  });
  const parsed = clientListingSchemaFor(limits).safeParse(await readJson(req));
  if (!parsed.success) return fail('Check the form', 422, { fields: z.flattenError(parsed.error).fieldErrors });
  const { tags, unlisted, files, screenshots, platforms, repo, ...data } = parsed.data;

  const problem = checkReleaseSetup(parsed.data);
  if (problem) return fail('Check the form', 422, { fields: { [problem.field]: [problem.message] } });

  const normalisedRepo = data.releaseSource === 'GITHUB' ? parseRepo(repo) : null;
  if (normalisedRepo && normalisedRepo !== m.client.repo) {
    const taken = await db.clientListing.findFirst({
      where: { repo: normalisedRepo, status: { not: 'REMOVED' }, id: { not: m.client.id } },
      select: { ownerId: true },
    });
    if (taken) return fail('Check the form', 422, { fields: { repo: ['That repository is already listed on YapBoard'] } });
  }

  /**
   * Where the downloads come from is the part of a listing a review is really about - staff approved a page
   * pointing at one repo, not at whatever it's pointed at afterwards. So changing it sends the listing back to
   * the queue, the same way changing a bot's support server does. Everything else saves and stays live.
   */
  const sourceChanged = normalisedRepo !== m.client.repo || data.releaseSource !== m.client.releaseSource;

  const status = !isClientOwnerEditable(m.client.status)
    ? m.client.status
    : m.client.status === 'DENIED' || m.client.status === 'PENDING' || (sourceChanged && !isStaff(m.user))
      ? 'PENDING'
      : approvedClientStatus(unlisted);

  const backToQueue = status === 'PENDING' && m.client.status !== 'PENDING';
  await db.$transaction(async (tx) => {
    await tx.clientListing.update({
      where: { id: m.client.id },
      data: {
        ...data,
        repo: normalisedRepo,
        screenshots: JSON.stringify(screenshots),
        platforms: JSON.stringify(platforms),
        // While it's queued, `unlisted` is a request rather than a live setting (lib/clients.ts).
        status,
        requestedUnlisted: unlisted,
        ...(backToQueue ? { statusNote: null, reviewedAt: null, reviewedById: null } : {}),
      },
    });
    await setClientTags(tx, m.client.id, tags);
    await setManualFiles(tx, m.client.id, files);
    // Links that came from the old repo's releases aren't this client's any more.
    if (sourceChanged) await tx.clientDownload.deleteMany({ where: { clientId: m.client.id, managed: true } });
  });

  if (sourceChanged && normalisedRepo) await syncClientRelease(m.client.id).catch(() => {});

  return json({ ok: true, status, inReview: status === 'PENDING', slug: m.client.slug });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const m = await loadManaged(req, ctx);
  if (m.error) return m.error;
  // A co-manager may edit the listing but never delete it - that stays with the owner (lib/manage.ts).
  if (!isOwner(m.user, m.client) && !isStaff(m.user)) return fail('Only the listing’s owner can delete it.', 403);
  // A staff-removed listing stays as a tombstone so it can't simply be re-added.
  if (m.client.status === 'REMOVED') return fail('This listing was removed by staff', 403);
  if (!isStaff(m.user)) {
    if (m.client.status === 'HIDDEN') return fail('YapBoard staff hid this listing, so it can’t be deleted. Contact us if you think that’s a mistake.', 403);
    const open = await db.report.count({ where: { clientId: m.client.id, status: 'OPEN' } });
    if (open) return fail('This listing has a report waiting for YapBoard staff. You can delete it once they’ve looked at it.', 409);
  }
  await db.clientListing.delete({ where: { id: m.client.id } });
  // The listing is gone, so it must stop holding a Pro slot (src/lib/pro.ts).
  await releaseSlot('client', m.client.id);
  return json({ ok: true });
}
