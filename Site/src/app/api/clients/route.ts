// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkReleaseSetup, clientListingSchema, setClientTags, setManualFiles, syncClientRelease, uniqueSlug } from '@/lib/clients';
import { db } from '@/lib/db';
import { parseRepo } from '@/lib/github';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';

/**
 * Listing a client.
 *
 * Nothing here can be checked against Yapin' the way a server's invite or a bot's support server can — a client
 * is a file on somebody's release page. So the gate is the review queue every listing goes through, and the
 * terms the lister accepts in the dialog before this request is sent. `agreeTerms` is required rather than
 * assumed: the dialog is the only place the two sets of terms are put in front of them, and the timestamp it
 * writes is the record that it happened.
 */
const createSchema = clientListingSchema.extend({
  /** Set by the terms dialog in components/clients/ClientListingForm.tsx. Without it nothing is created. */
  agreeTerms: z.literal(true, 'Accept the client terms before submitting'),
});

export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`client:create:${g.user.id}`, 8, 60 * 60_000)) return fail('Slow down a little. Try again later.', 429);

  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Check the form', 422, { fields: z.flattenError(parsed.error).fieldErrors });
  const { tags, unlisted, files, screenshots, platforms, repo, agreeTerms: _agreed, ...data } = parsed.data;

  const problem = checkReleaseSetup(parsed.data);
  if (problem) return fail('Check the form', 422, { fields: { [problem.field]: [problem.message] } });

  // Two listings of the same repo would compete for the same downloads, so the first one keeps it.
  const normalisedRepo = data.releaseSource === 'GITHUB' ? parseRepo(repo) : null;
  if (normalisedRepo) {
    const taken = await db.clientListing.findFirst({
      where: { repo: normalisedRepo, status: { not: 'REMOVED' } },
      select: { id: true, ownerId: true, slug: true },
    });
    if (taken) {
      return fail(
        taken.ownerId === g.user.id ? 'You’ve already listed that repository.' : 'Someone has already listed that repository. If it’s yours, send a removal request from its page.',
        409,
        { fields: { repo: ['That repository is already listed'] } },
      );
    }
  }

  const slug = await uniqueSlug(data.name);
  const now = new Date();
  const created = await db.$transaction(async (tx) => {
    const row = await tx.clientListing.create({
      data: {
        ...data,
        slug,
        repo: normalisedRepo,
        screenshots: JSON.stringify(screenshots),
        platforms: JSON.stringify(platforms),
        // Nothing goes on the board until staff approve it; approving reads requestedUnlisted (lib/clients.ts).
        status: 'PENDING',
        requestedUnlisted: unlisted,
        termsAgreedAt: now,
        ownerId: g.user.id,
        bumpedAt: now,
      },
      select: { id: true, slug: true },
    });
    await setClientTags(tx, row.id, tags);
    await setManualFiles(tx, row.id, files);
    return row;
  });

  // First sync now, so the lister (and the staff member reviewing it) see the real release straight away.
  // A GitHub hiccup is recorded on the listing and retried on the next page view, so it never blocks listing.
  if (normalisedRepo) await syncClientRelease(created.id).catch(() => {});

  return json({ id: created.id, slug: created.slug, status: 'PENDING' }, 201);
}
