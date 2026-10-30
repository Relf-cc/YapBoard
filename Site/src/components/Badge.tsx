// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { useId, type CSSProperties } from 'react';
import clsx from 'clsx';
import { BADGES, MARKS, sortBadges, type BadgeKind, type MarkKind } from '@/lib/badges';
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

/**
 * Where the extra sparkles sit on a mark that asks for them, and when each one fires.
 *
 * Hand-placed rather than random: they ring the seal at uneven distances so the twinkle reads as light
 * catching an object, and the offsets are deliberately not evenly spaced - three sparks on a shared rhythm
 * look like a blinking error light rather than something shining.
 */
const SPARKLES: { x: number; y: number; scale: number; offset: string }[] = [
  { x: -17.4, y: 17.2, scale: 0.72, offset: '1.15s' },
  { x: -1.2, y: 2.4, scale: 0.5, offset: '1.85s' },
  { x: -19.8, y: 3.6, scale: 0.42, offset: '2.5s' },
];

/**
 * One badge: a coloured seal that glistens - a light sweep crosses it every few seconds and a small sparkle
 * twinkles. `seed` (e.g. the server id) offsets the timing so a grid of badges doesn't shine in lockstep.
 */
export function Badge({ kind, size = 18, seed = '', className, tooltip = true }: { kind: BadgeKind; size?: number; seed?: string; className?: string; tooltip?: boolean }) {
  const mark = <BadgeMark kind={kind} size={size} seed={seed} className={tooltip ? undefined : className} />;
  if (!tooltip) return mark;
  return (
    <Tooltip className={clsx('relative z-10 align-middle', className)} content={<BadgeTip kind={kind} seed={seed} />}>
      {mark}
    </Tooltip>
  );
}

/**
 * Every badge a server holds, in display order. Past `max` the rest collapse into a "+n" chip that lists
 * them on hover, so a long row never pushes a server's name out of a card.
 */
export function BadgeRow({
  kinds,
  size = 17,
  seed = '',
  max = 3,
  className,
  tooltip = true,
}: {
  kinds: readonly (string | null | undefined)[];
  size?: number;
  seed?: string;
  max?: number;
  className?: string;
  tooltip?: boolean;
}) {
  const all = sortBadges(kinds);
  if (!all.length) return null;
  // With one over the limit, showing it beats a "+1" chip that's the same width.
  const shown = all.length <= max + 1 ? all : all.slice(0, max);
  const rest = all.slice(shown.length);
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 align-middle', className)}>
      {shown.map((k) => (
        <Badge key={k} kind={k} size={size} seed={seed} tooltip={tooltip} />
      ))}
      {rest.length > 0 &&
        (tooltip ? (
          <Tooltip
            className="relative z-10"
            content={
              <span className="flex flex-col gap-2">
                {rest.map((k) => (
                  <BadgeTip key={k} kind={k} seed={seed} />
                ))}
              </span>
            }
          >
            <BadgeMore n={rest.length} size={size} />
          </Tooltip>
        ) : (
          <BadgeMore n={rest.length} size={size} />
        ))}
    </span>
  );
}

/** Badges written out with their names, for pages with room for them (a listing page). */
export function BadgeNames({ kinds, seed = '', className }: { kinds: readonly (string | null | undefined)[]; seed?: string; className?: string }) {
  const all = sortBadges(kinds);
  if (!all.length) return null;
  return (
    <span className={clsx('flex flex-wrap items-center gap-1.5', className)}>
      {all.map((k) => (
        <Tooltip key={k} content={BADGES[k].blurb}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[12px] font-semibold"
            style={{ color: BADGES[k].from, borderColor: `${BADGES[k].glow}44`, background: `${BADGES[k].glow}12` }}
          >
            <BadgeMark kind={k} size={14} seed={seed} />
            {BADGES[k].long}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}

function BadgeTip({ kind, seed, blurb }: { kind: MarkKind; seed?: string; blurb?: React.ReactNode }) {
  const m = MARKS[kind];
  return (
    <span className="flex items-start gap-2.5">
      <BadgeMark kind={kind} size={18} seed={seed} className="mt-px" />
      <span>
        <span className="block font-semibold text-ink">{m.long}</span>
        <span className="block mt-0.5 text-ink-3">{blurb ?? m.blurb}</span>
      </span>
    </span>
  );
}

/**
 * The Pro seal, with the tooltip the badges beside it have.
 *
 * `Badge` can't draw this one: Pro is bought rather than granted, so it isn't in BADGES and isn't a
 * `BadgeKind` (src/lib/badges.ts). It is drawn as the same seal because to a reader it means the same
 * kind of thing - something this listing has - and a mark with no explanation is a mark people guess at.
 *
 * `blurb` overrides the default for places where the subject isn't a listing: the account menu, where it
 * is the person who holds the plan.
 */
export function ProMark({ size = 17, seed = '', className, blurb }: { size?: number; seed?: string; className?: string; blurb?: React.ReactNode }) {
  return (
    <Tooltip className={clsx('relative z-10 align-middle', className)} content={<BadgeTip kind="PRO" seed={seed} blurb={blurb} />}>
      <BadgeMark kind="PRO" size={size} seed={seed} />
    </Tooltip>
  );
}

/**
 * The owner's seal, with the same tooltip treatment the badges beside it have.
 *
 * Its own component for the same reason `ProMark` is: `Badge` only draws things in BADGES, and this is not
 * in BADGES on purpose - there is one owner, it is not granted, and the portal must not be able to grant
 * it. Like ProMark it sits *outside* the badge row, so it never counts towards a row's `max`.
 */
export function OwnerMark({ size = 17, seed = '', className }: { size?: number; seed?: string; className?: string }) {
  return (
    <Tooltip className={clsx('relative z-10 align-middle', className)} content={<BadgeTip kind="OWNER" seed={seed} />}>
      <BadgeMark kind="OWNER" size={size} seed={seed} />
    </Tooltip>
  );
}

function BadgeMore({ n, size }: { n: number; size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised font-semibold tabular-nums text-ink-3"
      style={{ height: size, minWidth: size, padding: '0 3px', fontSize: Math.max(9, Math.round(size * 0.58)) }}
    >
      +{n}
    </span>
  );
}

export function BadgeMark({ kind, size, seed = '', className }: { kind: MarkKind; size: number; seed?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const m = MARKS[kind];
  const delay = `${((hueFor(seed || kind) % 36) / 10).toFixed(1)}s`;
  return (
    <span
      role="img"
      aria-label={m.long}
      className={clsx('badge-mark relative inline-flex shrink-0 align-middle', className)}
      data-sparkle={m.sparkle ? '' : undefined}
      style={{ width: size, height: size, '--badge-delay': delay, '--badge-glow': `${m.glow}66` } as CSSProperties}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} overflow="visible" aria-hidden>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={m.from} />
            <stop offset="1" stopColor={m.to} />
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
        {/* Filled icons get a hairline stroke of the same colour so their corners round off like the strokes do. */}
        {m.icon.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={p.w ? 'none' : '#fff'}
            stroke="#fff"
            strokeWidth={p.w ?? 0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <path className="badge-spark" d={STAR} fill="#fff" />
        {/* A mark that declares `sparkle` gets that many more, each on its own beat (src/lib/badges.ts). */}
        {SPARKLES.slice(0, m.sparkle ?? 0).map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y}) scale(${s.scale})`}>
            <path className="badge-spark" style={{ '--spark-offset': s.offset } as CSSProperties} d={STAR} fill="#fff" />
          </g>
        ))}
      </svg>
    </span>
  );
}
