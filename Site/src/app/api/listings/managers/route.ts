// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { isOwner, managerSelect } from '@/lib/manage';
import { isListingKind, limitsOf, type ListingKind } from '@/lib/pro';
import type { SessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Co-managers: the people besides the owner who may edit a listing.
 *
 *   POST   - add somebody by their Yapin' username
 *   DELETE - take them off again
 *
 * Both are **owner only**, including against staff, and that is the point: a co-manager who could add
 * another co-manager would turn the three an owner allowed into any number, and the whole feature is
 * meant to be help with a listing rather than a route to controlling it. src/lib/manage.ts has the rest.
 *
 * Adding needs a slot under YapBoard Pro; keeping does not. See the note on lapsing in src/lib/manage.ts
 * - locking a co-manager out when a card expires would break the exact case this is for.
 */

const body = z.object({
  kind: z.string().refine(isListingKind, 'Pick a server, bot or client'),
  listingId: z.string().trim().min(1).max(64),
  /** POST: who to add. A YapBoard username, which means they must have signed in here at least once. */
  username: z.string().trim().min(1).max(40).optional(),
  /** DELETE: who to remove. */
  userId: z.string().trim().min(1).max(64).optional(),
});

/** The listing, if this person owns it. `null` covers both "no such listing" and "not yours". */
async function ownListing(kind: ListingKind, listingId: string, user: SessionUser) {
  const select = { id: true, ownerId: true, status: true, name: true, ...managerSelect } as const;
  const row =
    kind === 'server'
      ? await db.server.findUnique({ where: { id: listingId }, select })
      : kind === 'bot'
        ? await db.botListing.findUnique({ where: { id: listingId }, select })
        : await db.clientListing.findUnique({ where: { id: listingId }, select });
  if (!row || !isOwner(user, row)) return null;
  return row;
}

/** Which column the listing id goes in. Exactly one is set, the same shape Report uses. */
const columnFor = (kind: ListingKind, listingId: string) =>
  kind === 'server' ? { serverId: listingId } : kind === 'bot' ? { botId: listingId } : { clientId: listingId };

export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`managers:${g.user.id}`, 20, 10 * 60_000)) return fail('Slow down a little.', 429);

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success || !parsed.data.username) return fail('Pick somebody to add', 422, { fields: { username: ['Enter their username'] } });
  const kind = parsed.data.kind as ListingKind;
  const { listingId, username } = parsed.data;

  const listing = await ownListing(kind, listingId, g.user);
  if (!listing) return fail('That isn’t one of your listings.', 404);
  // A listing staff have removed can never come back, so there's nothing to co-manage.
  if (listing.status === 'REMOVED') return fail('This listing was removed by YapBoard staff.', 403);

  const limits = await limitsOf(kind, listing.id, listing.ownerId);
  if (listing.managers.length >= limits.managers) {
    return limits.managers === 0
      ? fail('Co-managers need YapBoard Pro.', 403, { needsPro: true })
      : fail(`A listing can have ${limits.managers} co-managers.`, 409, { atLimit: true });
  }

  /**
   * Looked up by username rather than invited by email, because YapBoard has no email for anybody - an
   * account exists only once somebody has signed in with Yapin'. So the honest failure is "they need to
   * sign in to YapBoard once first", which is what this says.
   */
  const person = await db.user.findFirst({
    where: { username: { equals: username.replace(/^@/, '') } },
    select: { id: true, username: true, displayName: true, avatarUrl: true, bannedAt: true },
  });
  if (!person) {
    return fail('No YapBoard account with that username. They need to sign in to YapBoard once before you can add them.', 404, {
      fields: { username: ['Not found - have they signed in to YapBoard?'] },
    });
  }
  if (person.bannedAt) return fail('That account is banned from YapBoard.', 403, { fields: { username: ['That account is banned'] } });
  if (person.id === listing.ownerId) return fail('You already own this listing.', 409, { fields: { username: ['That’s you'] } });

  try {
    await db.listingManager.create({ data: { ...columnFor(kind, listingId), userId: person.id, invitedById: g.user.id } });
  } catch (e) {
    // The unique index on (listing, user) is what makes a double-click harmless.
    if (typeof e === 'object' && e && 'code' in e && e.code === 'P2002') return json({ ok: true, alreadyAdded: true });
    throw e;
  }

  return json({ ok: true, manager: { userId: person.id, username: person.username, displayName: person.displayName, avatarUrl: person.avatarUrl } }, 201);
}

export async function DELETE(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success || !parsed.data.userId) return fail('Pick somebody to remove', 422);
  const kind = parsed.data.kind as ListingKind;
  const { listingId, userId } = parsed.data;

  const listing = await ownListing(kind, listingId, g.user);
  if (!listing) return fail('That isn’t one of your listings.', 404);

  // Scoped to this listing, so an owner can only ever remove somebody from their own.
  const removed = await db.listingManager.deleteMany({ where: { ...columnFor(kind, listingId), userId } });
  if (!removed.count) return fail('They aren’t a co-manager of this listing.', 404);
  return json({ ok: true });
}
