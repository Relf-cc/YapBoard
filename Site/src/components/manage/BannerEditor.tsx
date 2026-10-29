'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useRef, useState } from 'react';
import { Move, RotateCcw, ZoomIn } from 'lucide-react';
import clsx from 'clsx';
import { DEFAULT_BANNER_FRAME, MAX_BANNER_SCALE, MIN_BANNER_SCALE, type BannerFrame } from '@/lib/pro-fields';
import { bannerStyle } from '../ListingHero';
import { ImagePicker } from './ImagePicker';

/**
 * Pick a banner, then say which part of it people see.
 *
 * A header is a wide, shallow strip and a banner is usually neither, so `object-cover` has to throw most of
 * a tall image away - and left to itself it throws away whatever isn't in the middle, which is reliably the
 * half with the logo in it. This is the fix: drag the picture to choose what survives the crop, zoom if the
 * interesting part is small.
 *
 * The preview composes the image through `bannerStyle`, the same function the real header uses, so what is
 * dragged here is what gets drawn there. Two numbers and a zoom are all that's stored - no cropping, no
 * second copy of the image - so re-framing later is free and the original is never touched.
 */
export function BannerEditor({
  url,
  frame,
  onUrlChange,
  onFrameChange,
  error,
}: {
  url: string;
  frame: BannerFrame;
  onUrlChange: (url: string) => void;
  onFrameChange: (frame: BannerFrame) => void;
  error?: string[];
}) {
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  const move = (dx: number, dy: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    /**
     * Pixels to percent. Divided by the zoom because at 2× the same drag should move the picture half as
     * far across the image, and negated because dragging the picture right reveals what was off to its
     * left - the focal point moves the other way to the hand.
     */
    onFrameChange({
      ...frame,
      x: clamp(frame.x - (dx / box.width) * 100 / frame.scale, 0, 100),
      y: clamp(frame.y - (dy / box.height) * 100 / frame.scale, 0, 100),
    });
  };

  const framed = frame.x !== DEFAULT_BANNER_FRAME.x || frame.y !== DEFAULT_BANNER_FRAME.y || frame.scale !== DEFAULT_BANNER_FRAME.scale;

  return (
    <div className="space-y-3">
      <ImagePicker kind="banner" value={url} onChange={onUrlChange} placeholder="https://…/banner.png" />
      {error?.length ? <p className="text-[13px] text-danger">{error[0]}</p> : null}

      {url && (
        <>
          <div
            ref={stage}
            // A listing header is about five times as wide as it is tall on a desktop screen. Narrower
            // screens crop in further from the sides, which the note below says rather than mimics: a
            // preview that guessed at somebody's phone would be wrong in a more confusing way.
            className={clsx(
              'relative aspect-[40/7] w-full touch-none select-none overflow-hidden rounded-xl border border-line bg-raised',
              grabbing ? 'cursor-grabbing' : 'cursor-grab',
            )}
            role="group"
            aria-label="Banner framing. Drag the image, or use the arrow keys, to choose what shows."
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
              setGrabbing(true);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              move(e.clientX - drag.current.x, e.clientY - drag.current.y);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => {
              drag.current = null;
              setGrabbing(false);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setGrabbing(false);
            }}
            // Keyboard framing, because a drag is the one interaction a keyboard can't do at all. A step is
            // deliberately coarse enough to cross the picture in a few presses.
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 2;
              const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
              if (!by) return;
              e.preventDefault();
              onFrameChange({ ...frame, x: clamp(frame.x + by[0], 0, 100), y: clamp(frame.y + by[1], 0, 100) });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover" style={bannerStyle(frame)} />
            {/* The gradients the real header lays over its banner, so the preview isn't brighter than the page. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-bg/10" />
            {!grabbing && (
              <span className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm">
                <Move size={13} /> Drag to move
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn size={15} className="shrink-0 text-ink-3" />
            <input
              type="range"
              min={MIN_BANNER_SCALE}
              max={MAX_BANNER_SCALE}
              step={0.05}
              value={frame.scale}
              aria-label="Banner zoom"
              onChange={(e) => onFrameChange({ ...frame, scale: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[var(--accent)]"
            />
            <span className="w-10 shrink-0 text-right text-[12.5px] tabular-nums text-ink-3">{frame.scale.toFixed(1)}×</span>
            <button
              type="button"
              onClick={() => onFrameChange(DEFAULT_BANNER_FRAME)}
              disabled={!framed}
              title="Back to the whole image, centred"
              className="btn btn-ghost btn-sm shrink-0 disabled:opacity-40"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Narrow screens crop in from the sides, so keep anything that matters - a logo, your server&rsquo;s name - towards the middle.
          </p>
        </>
      )}
    </div>
  );
}
