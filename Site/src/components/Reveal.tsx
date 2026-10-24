import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Fades + lifts its children in. Pure CSS: rises as it scrolls into view where supported
 * (scroll-driven animations), otherwise on load. Never hides content when JS is slow.
 */
export function Reveal({ children, delay = 0, y = 16, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <div className={clsx('reveal', className)} style={{ '--d': `${delay * 1000}ms`, '--rise-y': `${y}px` } as CSSProperties}>
      {children}
    </div>
  );
}
