// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import clsx from 'clsx';
import { COMMENTER_BADGES, type CommenterBadgeKind } from '@/lib/comment-badges';

/**
 * The small chip beside a name in a thread - "Owner", "YapBoard Staff".
 *
 * Deliberately not the scalloped seal in Badge.tsx. That one marks a *listing*; this marks a person's
 * standing in one conversation, and using the same shape for both would make an owner's reply look like a
 * staff endorsement of the listing it sits under.
 */
export function CommenterBadge({ kind, className }: { kind: CommenterBadgeKind; className?: string }) {
  const def = COMMENTER_BADGES[kind];
  return (
    <span
      title={def.title}
      className={clsx(
        'inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10.5px] font-semibold leading-[1.45] tracking-wide',
        def.className,
        className,
      )}
    >
      {def.label}
    </span>
  );
}

export function CommenterBadges({ kinds, className }: { kinds: readonly CommenterBadgeKind[]; className?: string }) {
  if (!kinds.length) return null;
  return (
    <span className={clsx('inline-flex flex-wrap items-center gap-1', className)}>
      {kinds.map((k) => (
        <CommenterBadge key={k} kind={k} />
      ))}
    </span>
  );
}
