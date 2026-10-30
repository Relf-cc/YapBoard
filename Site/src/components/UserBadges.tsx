// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { ChevronsUp, Flag, Heart, PenLine, Quote } from 'lucide-react';
import clsx from 'clsx';
import { USER_BADGES, type BadgeTone, type UserBadgeKind } from '@/lib/user-badges';

/**
 * Badges on a person, drawn as chips.
 *
 * Chips rather than the listing seal in Badge.tsx, and the difference is the point: a seal is YapBoard's
 * judgement about a listing, and these are facts about what somebody has done. Using one shape for both
 * would read as the board vouching for the person.
 */
const ICONS = { flag: Flag, pen: PenLine, quote: Quote, chevrons: ChevronsUp, heart: Heart } as const;

const TONES: Record<BadgeTone, string> = {
  gold: 'border-[#e0a019]/45 bg-[#e0a019]/12 text-[#f2bb3c]',
  orange: 'border-accent-soft bg-accent-soft text-accent',
  blue: 'border-[#1683ea]/45 bg-[#1683ea]/12 text-[#5cbcff]',
  green: 'border-ok/40 bg-ok/10 text-ok',
  grey: 'border-line-strong bg-surface-2 text-ink-2',
};

export function UserBadge({ kind, size = 'md' }: { kind: UserBadgeKind; size?: 'sm' | 'md' }) {
  const def = USER_BADGES[kind];
  const Icon = ICONS[def.icon];
  return (
    <span
      title={def.blurb}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold',
        TONES[def.tone],
        size === 'sm' ? 'px-1.5 py-px text-[10.5px]' : 'px-2.5 py-1 text-[12px]',
      )}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.4} />
      {def.label}
    </span>
  );
}

export function UserBadgeRow({ kinds, size = 'md', className }: { kinds: readonly UserBadgeKind[]; size?: 'sm' | 'md'; className?: string }) {
  if (!kinds.length) return null;
  return (
    <span className={clsx('inline-flex flex-wrap items-center gap-1.5', className)}>
      {kinds.map((k) => (
        <UserBadge key={k} kind={k} size={size} />
      ))}
    </span>
  );
}
