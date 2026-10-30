// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import clsx from 'clsx';

/**
 * The label on a card that is in a ranked list partly because somebody paid.
 *
 * This is not decoration, and it is not optional. A marketplace that ranks on payment has to say so - it is
 * a legal requirement in the EU and the UK - and this label plus the line on /pro is what says it. The
 * tooltip gives the size of the thing rather than just its existence, because "we boost paying listings" is
 * only half an answer and the half that invites the worst guess.
 *
 * Deliberately separate from `ProMark` (the purple seal in Badge.tsx), which marks "this listing is on a
 * plan" on a listing page and in places nothing was ranked. Two marks, two jobs: this one appears when a
 * boost actually put the card where it is.
 */
export function Promoted({ className }: { className?: string }) {
  return (
    <span
      title="On a YapBoard Pro plan. Pro listings get a small ranking boost - worth about a day of activity."
      className={clsx(
        'pointer-events-auto inline-flex select-none items-center rounded-full border border-[#e0a019]/50 bg-[#e0a019]/15 px-2 py-0.5',
        'text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#f2bb3c] backdrop-blur-sm',
        className,
      )}
    >
      Promoted
    </span>
  );
}
