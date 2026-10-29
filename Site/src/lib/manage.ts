// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { isStaff, type SessionUser } from './session';

/**
 * Who may edit a listing.
 *
 * Three answers, and they are different on purpose:
 *
 * - **Edit** (`canManage`) - the owner, any co-manager they added, or staff.
 * - **Own** (`isOwner`) - only the owner. Deleting the listing, adding or removing co-managers, and
 *   anything to do with billing. A co-manager is help with the listing, never a claim on it, so none of
 *   those are theirs to do - and in particular a co-manager cannot add another co-manager, or the three
 *   the owner allowed would quietly become any number.
 * - **Staff** - `isStaff`, which `canManage` already covers.
 *
 * ## Why the type demands `managers`
 *
 * `canManage` takes the manager rows rather than looking them up, so a permission check is never a
 * surprise query inside a loop. The cost of that is a caller who forgets to select them, which would
 * silently lock a legitimate co-manager out of a listing they can edit - a bug nobody would notice until
 * somebody complained. So the parameter is required, not optional: leave the select off and it doesn't
 * compile. `managerSelect` is the select to spread.
 *
 * ## Co-managers and a lapsed plan
 *
 * Adding one needs YapBoard Pro; keeping one does not. `Limits.managers` is a count (0 free, 3 on Pro),
 * so it falls under the same rule as tags and the description - **a raised cap governs what you can add,
 * not what you keep** (see src/lib/pro.ts). Nothing here consults a plan at all.
 *
 * That is deliberate, and it is the safe way round. The whole reason this feature exists is the listing
 * whose owner has walked away; locking their co-manager out the moment a card expires would turn the one
 * problem it solves into an unmanageable listing, which is worse than not having built it.
 */

/** The shape every permission check needs. Spread `managerSelect` into the query and you have it. */
export type ManagedListing = { ownerId: string; managers: { userId: string }[] };

/** Spread into a Prisma `select` so the row satisfies `ManagedListing`. */
export const managerSelect = { managers: { select: { userId: true } } } as const;

/** Edit the listing, and bump it. Owner, co-manager or staff. */
export function canManage(user: SessionUser | null, listing: ManagedListing): boolean {
  if (!user || user.bannedAt) return false;
  if (isStaff(user)) return true;
  if (user.id === listing.ownerId) return true;
  return listing.managers.some((m) => m.userId === user.id);
}

/**
 * The owner themselves, and nobody else - not even staff.
 *
 * Staff are excluded on purpose: this guards deleting a listing and changing who may edit it, and the
 * portal has its own hide/remove tools with an audit trail behind them. A staff member who wants a
 * listing gone should leave a record of it rather than borrowing the owner's buttons.
 */
export function isOwner(user: SessionUser | null, listing: { ownerId: string }): boolean {
  return !!user && !user.bannedAt && user.id === listing.ownerId;
}

/** True when this person can edit but doesn't own it - the case the UI has to explain. */
export const isCoManager = (user: SessionUser | null, listing: ManagedListing) => canManage(user, listing) && !isOwner(user, listing) && !isStaff(user);
