// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { CSSProperties } from 'react';
import { BotCard } from './BotCard';
import type { BotCard as Card } from '@/lib/bots';

/** Cards rise in with a short stagger. A new `animationKey` remounts the grid so filter changes replay it. */
export function BotGrid({ bots, activeTags, animationKey }: { bots: Card[]; activeTags?: string[]; animationKey?: string }) {
  return (
    <div key={animationKey} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {bots.map((b, i) => (
        <div key={b.id} className="rise flex" style={{ '--d': `${Math.min(i, 12) * 40}ms` } as CSSProperties}>
          <BotCard bot={b} activeTags={activeTags} />
        </div>
      ))}
    </div>
  );
}
