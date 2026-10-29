// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { CSSProperties } from 'react';
import { MIN_BANNER_SCALE, type BannerFrame } from '@/lib/pro-fields';

/**
 * How a framed banner is drawn, shared by the page and by the editor that sets it.
 *
 * `object-position` picks which part of the image survives the crop, and the scale zooms about that same
 * point - so dragging moves what you chose towards the middle and zooming goes further into it, rather than
 * into the centre of the file. Both the hero and the editor's preview call this, because a preview that
 * composes the transform slightly differently is a preview that lies.
 *
 * No framing, or framing left at its default, means no style at all: a listing that has never been framed
 * draws exactly the centred `object-cover` banner it drew before any of this existed.
 */
export function bannerStyle(frame: BannerFrame | null | undefined): CSSProperties | undefined {
  if (!frame) return undefined;
  const { x, y, scale } = frame;
  const position = `${x}% ${y}%`;
  if (scale <= MIN_BANNER_SCALE) return x === 50 && y === 50 ? undefined : { objectPosition: position };
  return { objectPosition: position, transform: `scale(${scale})`, transformOrigin: position };
}

/**
 * The header at the top of a listing page.
 *
 * Four styles, each drawn from the listing's own accent colour, with their banner image over the top when
 * they've set one. It's the main thing that stops every listing page looking like every other one.
 *
 * Shared by client pages, where the lister has always been able to pick, and server pages, where picking
 * is a YapBoard Pro perk. A theme this file doesn't recognise - including the `DEFAULT` a free server
 * passes - draws the plain header servers have always had, so a listing that isn't entitled to pick keeps
 * exactly the page it had yesterday.
 */
export function ListingHero({ accent, theme, bannerUrl, frame }: { accent: string; theme: string; bannerUrl: string | null; frame?: BannerFrame | null }) {
  const known = theme === 'GLOW' || theme === 'GRID' || theme === 'WAVE' || theme === 'FLAT';
  const dots = theme === 'GRID' || !known;
  const glow = theme === 'GLOW' || !known;

  return (
    <div className="relative h-40 overflow-hidden border-b border-line sm:h-56" style={{ background: `color-mix(in srgb, ${accent} 34%, var(--bg))` }}>
      {dots && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, color-mix(in srgb, ${accent} 70%, transparent) 1px, transparent 0)`, backgroundSize: '18px 18px' }}
        />
      )}
      {theme === 'WAVE' && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: `repeating-linear-gradient(115deg, color-mix(in srgb, ${accent} 55%, transparent) 0 14px, transparent 14px 34px)` }}
        />
      )}
      {glow && (
        <>
          <div aria-hidden className="absolute -left-10 bottom-0 h-56 w-56 rounded-full opacity-50 blur-3xl sm:h-72 sm:w-72" style={{ background: `color-mix(in srgb, ${accent} 85%, transparent)` }} />
          {/* The second blob is what makes GLOW a style rather than the plain header. */}
          {known && (
            <div aria-hidden className="absolute -right-16 -top-10 h-48 w-48 rounded-full opacity-35 blur-3xl sm:h-64 sm:w-64" style={{ background: `color-mix(in srgb, ${accent} 70%, transparent)` }} />
          )}
        </>
      )}
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className="absolute inset-0 size-full object-cover" style={bannerStyle(frame)} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-bg/10" />
    </div>
  );
}
