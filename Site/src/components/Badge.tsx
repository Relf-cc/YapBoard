import { useId, type CSSProperties } from 'react';
import clsx from 'clsx';
import { BADGES, isBadge } from '@/lib/badges';
import { hueFor } from '@/lib/format';
import { Tooltip } from './Tooltip';

/** Scalloped seal: a circle with 8 soft lobes, r(θ) = 9.7 + 1.15·cos 8θ around (12, 12). */
const SEAL = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const r = 9.7 + 1.15 * Math.cos(8 * t);
    pts.push(`${(12 + r * Math.cos(t)).toFixed(2)} ${(12 + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const STAR = 'M20.6 1.4l.55 1.65 1.65.55-1.65.55-.55 1.65-.55-1.65-1.65-.55 1.65-.55z';

const COLORS = {
  VERIFIED: { from: '#5cbcff', to: '#1683ea', glow: '#2b9bff' },
  OFFICIAL: { from: '#3fe39e', to: '#0d9e62', glow: '#1fc47f' },
};

/**
 * Blue (verified) or green (official) checkmark that glistens: a light sweep crosses it every few seconds
 * and a small sparkle twinkles. `seed` (e.g. the server id) offsets the timing so a grid of badges doesn't
 * shine in lockstep.
 */
export function Badge({ kind, size = 18, seed = '', className, tooltip = true }: { kind: string | null | undefined; size?: number; seed?: string; className?: string; tooltip?: boolean }) {
  if (!isBadge(kind)) return null;
  const mark = <BadgeMark kind={kind} size={size} seed={seed} className={tooltip ? undefined : className} />;
  if (!tooltip) return mark;
  return (
    <Tooltip
      className={clsx('relative z-10 align-middle', className)}
      content={
        <span className="flex items-start gap-2.5">
          <BadgeMark kind={kind} size={18} seed={seed} className="mt-px" />
          <span>
            <span className="block font-semibold text-ink">{BADGES[kind].long}</span>
            <span className="block mt-0.5 text-ink-3">{BADGES[kind].blurb}</span>
          </span>
        </span>
      }
    >
      {mark}
    </Tooltip>
  );
}

function BadgeMark({ kind, size, seed, className }: { kind: 'VERIFIED' | 'OFFICIAL'; size: number; seed: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const c = COLORS[kind];
  const delay = `${((hueFor(seed || kind) % 36) / 10).toFixed(1)}s`;
  return (
    <span
      role="img"
      aria-label={BADGES[kind].long}
      className={clsx('badge-mark relative inline-flex shrink-0 align-middle', className)}
      style={{ width: size, height: size, '--badge-delay': delay, '--badge-glow': `${c.glow}66` } as CSSProperties}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} overflow="visible" aria-hidden>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.from} />
            <stop offset="1" stopColor={c.to} />
          </linearGradient>
          <linearGradient id={`${id}s`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}c`}>
            <path d={SEAL} />
          </clipPath>
        </defs>
        <path d={SEAL} fill={`url(#${id}f)`} />
        <path d={SEAL} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="0.6" />
        <g clipPath={`url(#${id}c)`}>
          <g transform="skewX(-20)">
            <rect className="badge-shine" x="-12" y="-4" width="7" height="32" fill={`url(#${id}s)`} />
          </g>
        </g>
        <path d="M7.7 12.4l2.9 2.9 5.8-6.2" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        <path className="badge-spark" d={STAR} fill="#fff" />
      </svg>
    </span>
  );
}
