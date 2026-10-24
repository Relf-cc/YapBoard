import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';

/** Thin line marks, drawn a little loose on purpose so they read as drawn rather than generated. */
const PATHS = {
  hash: 'M9.2 4.2 7.6 19.8M16.6 4 15 19.6M4.6 9.1h15.6M3.8 15.2h15.4',
  plus: 'M12 5.2v13.6M5.3 12.1h13.5',
  chevrons: 'M6 13.2l6-5.9 6 6M6.2 19l5.8-5.8 6 5.9',
  ring: 'M12 5.1a6.9 6.9 0 1 1-.1 0',
  asterisk: 'M12 4.2v15.6M5.3 8.1l13.4 7.8M5.3 15.9l13.4-7.8',
  squiggle: 'M2 14.5c2.6-5.8 4.6-5.8 6.6-.2s4 5.6 6.6-.1 4.6-5.7 6.8.3',
  check: 'M5.2 12.6l4.4 4.5 9.2-10',
  zigzag: 'M2.5 15.2l3.9-6 4 6.1 3.8-6 4.1 6 3.2-4.8',
  arrow: 'M6.8 17.4 17 7.1M9.4 6.9h7.8v7.7',
} as const;

export type GlyphName = keyof typeof PATHS;

export function Glyph({ name, size = 24, className, style }: { name: GlyphName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} style={style}>
      <path d={PATHS[name]} />
    </svg>
  );
}

export type ScatterItem = {
  g: GlyphName;
  /** Where it sits in the nearest `relative` box. */
  at: Pick<CSSProperties, 'left' | 'right' | 'top' | 'bottom'>;
  size?: number;
  /** Resting tilt in degrees. */
  r?: number;
  /** Accent colour instead of grey. */
  accent?: boolean;
};

/**
 * Glyphs drifting around whatever sits in the same `relative` box. Hidden on phones unless `className`
 * says otherwise, so small screens stay clean. Items that sit outside the box should use `lg:block`.
 */
export function GlyphScatter({ items, className = 'hidden md:block' }: { items: ScatterItem[]; className?: string }) {
  return (
    <div aria-hidden className={clsx('pointer-events-none absolute inset-0', className)}>
      {items.map(({ g, at, size = 22, r = 0, accent }, i) => (
        <span key={i} className="reveal absolute" style={{ ...at, '--d': `${200 + i * 70}ms` } as CSSProperties}>
          <Glyph name={g} size={size} className={clsx('glyph-drift', accent ? 'text-accent/70' : 'text-ink-3/45')} style={{ '--r': `${r}deg`, '--drift-delay': `${-i * 1.3}s` } as CSSProperties} />
        </span>
      ))}
    </div>
  );
}

/** A loose hand-drawn arrow with a short mono note, for pointing at things. */
export function Note({ children, flip, className }: { children: ReactNode; flip?: boolean; className?: string }) {
  return (
    <div aria-hidden className={clsx('pointer-events-none flex items-start gap-1 text-accent', flip && 'flex-row-reverse', className)}>
      <span className={clsx('mt-[-2px] whitespace-nowrap font-mono text-[12px]', flip ? 'rotate-[3deg]' : '-rotate-[3deg]')}>{children}</span>
      <svg viewBox="0 0 64 40" width={64} height={40} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={clsx('mt-2 opacity-80', flip && '-scale-x-100')}>
        <path d="M3 5c17-2 33 3 44 14 3.2 3.2 5.6 7 7.4 11.6" />
        <path d="M48.6 27.4l6 4.4 1.2-7.4" />
      </svg>
    </div>
  );
}
