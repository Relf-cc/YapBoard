// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { getCommentsConfig, loadThread } from '@/lib/comments';
import type { ListingKind } from '@/lib/pro-fields';
import { getUser } from '@/lib/session';
import { Thread } from './Thread';

/**
 * The reviews section, loaded on the server and handed to the client in one piece.
 *
 * One component for all three boards: a listing page passes the row it already has, so this adds the
 * thread's own queries and nothing else. The settings switch (`enabled`) takes the whole section away
 * rather than showing an empty one - a board with comments paused should look like a board that never had
 * them, not like a board nobody has posted on.
 */
export async function Reviews({
  kind,
  listing,
  accent,
}: {
  kind: ListingKind;
  listing: { id: string; ownerId: string; status: string; reviewCount: number; ratingSum: number; commentCount: number; managers: { userId: string }[] };
  accent?: string;
}) {
  const cfg = await getCommentsConfig();
  if (!cfg.enabled) return null;

  const user = await getUser();
  const thread = await loadThread(kind, listing, user);
  const managerIds = listing.managers.map((m) => m.userId);
  const runsIt = !!user && (user.id === listing.ownerId || managerIds.includes(user.id));

  /**
   * Reading is for everybody; writing needs a listing that is actually listed. An unlisted or hidden page
   * still shows what is already there - taking somebody's review off the page because staff hid the listing
   * would be deleting their writing to punish somebody else.
   */
  const blocked = listing.status !== 'PUBLIC' ? 'closed' : !user ? 'login' : runsIt ? 'own' : null;

  return (
    <Thread
      kind={kind}
      listingId={listing.id}
      thread={thread}
      viewer={user ? { id: user.id, role: user.role } : null}
      listing={{ ownerId: listing.ownerId, managerIds }}
      ratings={cfg.ratings}
      blocked={blocked}
      accent={accent}
    />
  );
}
