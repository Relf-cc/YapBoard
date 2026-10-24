import type { CSSProperties, ReactNode } from 'react';
import { ServerCard } from './ServerCard';
import { ProCard } from './browse/ProCard';
import type { ServerCard as Card } from '@/lib/servers';

/**
 * Cards rise in with a short stagger. A new `animationKey` remounts the grid so filter changes replay it.
 * `adAt` puts the YapBoard Pro card in that slot; servers after it move along one.
 */
export function ServerGrid({ servers, activeTags, animationKey, adAt }: { servers: Card[]; activeTags?: string[]; animationKey?: string; adAt?: number }) {
  const cells: [string, ReactNode][] = servers.map((s) => [s.id, <ServerCard server={s} activeTags={activeTags} />]);
  if (adAt !== undefined) cells.splice(adAt, 0, ['pro-ad', <ProCard />]);
  return (
    <div key={animationKey} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cells.map(([key, card], i) => (
        <div key={key} className="rise flex" style={{ '--d': `${Math.min(i, 12) * 40}ms` } as CSSProperties}>
          {card}
        </div>
      ))}
    </div>
  );
}
