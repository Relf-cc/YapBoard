import type { CSSProperties } from 'react';
import { ServerCard } from './ServerCard';
import type { ServerCard as Card } from '@/lib/servers';

/** Cards rise in with a short stagger. A new `animationKey` remounts the grid so filter changes replay it. */
export function ServerGrid({ servers, activeTags, animationKey }: { servers: Card[]; activeTags?: string[]; animationKey?: string }) {
  return (
    <div key={animationKey} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {servers.map((s, i) => (
        <div key={s.id} className="rise flex" style={{ '--d': `${Math.min(i, 12) * 40}ms` } as CSSProperties}>
          <ServerCard server={s} activeTags={activeTags} />
        </div>
      ))}
    </div>
  );
}
