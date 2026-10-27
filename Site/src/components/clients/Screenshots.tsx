'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * A client's screenshots: a scrolling strip that opens full size.
 *
 * The images are hotlinked from wherever the lister put them, so each one can fail on its own; a broken URL
 * drops out of the strip rather than leaving a grey box behind. Nothing here is proxied or cached by YapBoard.
 */
export function Screenshots({ urls, name, accent }: { urls: string[]; name: string; accent: string }) {
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const shown = urls.filter((u) => !broken.has(u));

  useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? null : (i + 1) % shown.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? null : (i - 1 + shown.length) % shown.length));
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, shown.length]);

  if (!shown.length) return null;

  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {shown.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-raised transition-colors hover:border-line-strong"
            style={{ width: 'min(84vw, 420px)' }}
            aria-label={`Screenshot ${i + 1} of ${name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              onError={() => setBroken((b) => new Set(b).add(url))}
              className="aspect-[16/10] w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
            />
            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 2px ${accent}` }} />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && shown[open] && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(null)} />
            <motion.img
              key={shown[open]}
              src={shown[open]}
              alt=""
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative max-h-full max-w-full rounded-xl border border-line-strong object-contain shadow-2xl"
            />
            <button onClick={() => setOpen(null)} className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-lg bg-black/60 text-ink hover:bg-black/80" aria-label="Close">
              <X size={18} />
            </button>
            {shown.length > 1 && (
              <>
                <Arrow side="left" onClick={() => setOpen((i) => (i! - 1 + shown.length) % shown.length)} />
                <Arrow side="right" onClick={() => setOpen((i) => (i! + 1) % shown.length)} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Arrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous screenshot' : 'Next screenshot'}
      className={`absolute ${side === 'left' ? 'left-2 sm:left-5' : 'right-2 sm:right-5'} inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-ink hover:bg-black/80`}
    >
      <Icon size={20} />
    </button>
  );
}
