import type { CSSProperties } from 'react';
import { BADGES } from '@/lib/badges';
import { BadgeMark } from './Badge';

const SUPPORT = BADGES.SUPPORT;

/**
 * Decoration for a card whose listing holds the support badge: an orange wash and a beam that sweeps across.
 * Goes inside a `.support-card` (which clips it), behind the card's own content.
 */
export function SupportFlair({ seed = '' }: { seed?: string }) {
  return (
    <>
      <span aria-hidden className="support-wash" />
      {/* Offsetting by the seed keeps a grid of support cards from sweeping in lockstep. */}
      <span aria-hidden className="support-beam" style={{ '--beam-delay': `${(seed.length % 5) * 0.4}s` } as CSSProperties} />
    </>
  );
}

/** The same thing written out, for a listing page: says what the support server is for. */
export function SupportBanner({ seed = '', className }: { seed?: string; className?: string }) {
  return (
    <div
      className={`support-card relative flex items-center gap-3 overflow-hidden rounded-xl border bg-surface px-4 py-3 ${className ?? ''}`}
      style={{ background: `color-mix(in srgb, ${SUPPORT.glow} 10%, var(--surface))` }}
    >
      <SupportFlair seed={seed} />
      <BadgeMark kind="SUPPORT" size={26} seed={seed} className="relative shrink-0" />
      <p className="relative min-w-0 text-[13.5px] leading-snug text-ink-2">
        <span className="block font-semibold text-ink">{SUPPORT.long}</span>
        {SUPPORT.blurb}
      </p>
    </div>
  );
}
