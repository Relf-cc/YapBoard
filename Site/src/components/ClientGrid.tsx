// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { CSSProperties } from 'react';
import { ClientCard } from './ClientCard';
import type { ClientCard as Card } from '@/lib/clients';

/** Cards rise in with a short stagger. A new `animationKey` remounts the grid so filter changes replay it. */
export function ClientGrid({ clients, activeTags, animationKey }: { clients: Card[]; activeTags?: string[]; animationKey?: string }) {
  return (
    <div key={animationKey} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {clients.map((c, i) => (
        <div key={c.id} className="rise flex" style={{ '--d': `${Math.min(i, 12) * 40}ms` } as CSSProperties}>
          <ClientCard client={c} activeTags={activeTags} />
        </div>
      ))}
    </div>
  );
}
