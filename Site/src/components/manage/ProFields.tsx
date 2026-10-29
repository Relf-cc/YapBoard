'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { AnimatePresence, motion } from 'motion/react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { THEMES } from '@/lib/client-fields';
import { MAX_LINK_LABEL, type ListingLink } from '@/lib/pro-fields';
import { ScreenshotPickerRow } from './ImagePicker';

/**
 * The editors for the fields YapBoard Pro unlocks: the header style, the screenshot gallery and the extra
 * buttons beside Join.
 *
 * Shared by the server and client forms. Client listings have had the header style and screenshots since
 * before Pro existed, so these components take the cap as a number and know nothing about plans - a cap
 * of zero is how a form says "not on this listing", and `ProLock` is what it draws instead.
 */

/* ---------------- locked ---------------- */

/**
 * What stands in for a perk this listing hasn't got. Named rather than generic: "Screenshots" is a thing
 * the owner can picture, where "upgrade for more features" is not.
 */
export function ProLock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-raised/60 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
          <Lock size={15} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{body}</p>
          <Link href="/pro" className="btn btn-secondary btn-sm mt-3">
            See YapBoard Pro
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- header style ---------------- */

/** A tiny drawing of each header style, so the choice is made by looking rather than by reading four words. */
function ThemeSwatch({ theme, accent }: { theme: keyof typeof THEMES; accent: string }) {
  return (
    <span aria-hidden className="relative block h-12 w-full overflow-hidden" style={{ background: `color-mix(in srgb, ${accent} 26%, var(--bg))` }}>
      {theme === 'GLOW' && <span className="absolute -left-4 -bottom-6 size-20 rounded-full blur-xl" style={{ background: accent, opacity: 0.75 }} />}
      {theme === 'GRID' && (
        <span
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, color-mix(in srgb, ${accent} 75%, transparent) 1px, transparent 0)`, backgroundSize: '9px 9px' }}
        />
      )}
      {theme === 'WAVE' && (
        <span
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: `repeating-linear-gradient(115deg, color-mix(in srgb, ${accent} 60%, transparent) 0 6px, transparent 6px 14px)` }}
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
    </span>
  );
}

export function ThemePicker({ value, onChange, accent, idPrefix }: { value: string; onChange: (t: string) => void; accent: string; idPrefix: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((t) => (
        <button
          key={t}
          type="button"
          id={`${idPrefix}-theme-${t}`}
          aria-pressed={value === t}
          onClick={() => onChange(t)}
          className={clsx('overflow-hidden rounded-xl border text-left transition-colors', value === t ? 'border-accent/60' : 'border-line hover:border-line-strong')}
        >
          <ThemeSwatch theme={t} accent={accent} />
          <span className="block px-3 py-2 text-[13px] font-medium">{THEMES[t]}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- screenshots ---------------- */

export function ScreenshotEditor({ urls, onChange, error, max, hint }: { urls: string[]; onChange: (u: string[]) => void; error?: string[]; max: number; hint?: string }) {
  const replace = (i: number, url: string) => onChange(urls.map((x, j) => (j === i ? url : x)));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">Screenshots</span>
        <span className="text-xs tabular-nums text-ink-3">
          {urls.length}/{max}
        </span>
      </div>
      <p className="mb-3 text-[13px] text-ink-3">{hint ?? 'Optional, and the single best thing you can add. Upload an image or paste a link.'}</p>
      <div className="space-y-2">
        {urls.map((u, i) => (
          <ScreenshotPickerRow key={i} url={u} index={i} onRemove={() => onChange(urls.filter((_, j) => j !== i))} onUpload={(url) => replace(i, url)} onUrlChange={(url) => replace(i, url)} />
        ))}
      </div>
      {urls.length < max && (
        <button type="button" onClick={() => onChange([...urls, ''])} className="btn btn-secondary btn-sm mt-3">
          <Plus size={15} /> Add a screenshot
        </button>
      )}
      {error?.length ? <p className="mt-2 text-[13px] text-danger">{error[0]}</p> : null}
    </div>
  );
}

/* ---------------- extra links ---------------- */

/**
 * Buttons that sit beside Join. Deliberately a label and a link and nothing else: the moment one of these
 * can carry an image it stops being a button and starts being a second listing.
 */
export function LinksEditor({ links, onChange, error, max }: { links: ListingLink[]; onChange: (l: ListingLink[]) => void; error?: string[]; max: number }) {
  const set = (i: number, patch: Partial<ListingLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">Extra buttons</span>
        <span className="text-xs tabular-nums text-ink-3">
          {links.length}/{max}
        </span>
      </div>
      <p className="mb-3 text-[13px] text-ink-3">Shown next to Join on your page. A website, a wiki, a shop - whatever you&rsquo;d rather people saw than a wall of text.</p>
      <AnimatePresence initial={false}>
        {links.map((l, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 flex gap-2">
              <input
                className="field w-[34%] min-w-0"
                value={l.label}
                maxLength={MAX_LINK_LABEL}
                onChange={(e) => set(i, { label: e.target.value })}
                placeholder="Our wiki"
                aria-label={`Button ${i + 1} label`}
              />
              <input
                className="field min-w-0 flex-1"
                value={l.url}
                onChange={(e) => set(i, { url: e.target.value.trim() })}
                placeholder="https://…"
                inputMode="url"
                aria-label={`Button ${i + 1} link`}
              />
              <button
                type="button"
                onClick={() => onChange(links.filter((_, j) => j !== i))}
                aria-label={`Remove button ${i + 1}`}
                className="btn btn-secondary btn-sm shrink-0 px-2.5 text-ink-3 hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {links.length < max && (
        <button type="button" onClick={() => onChange([...links, { label: '', url: '' }])} className="btn btn-secondary btn-sm mt-1">
          <Plus size={15} /> Add a button
        </button>
      )}
      {error?.length ? <p className="mt-2 text-[13px] text-danger">{error[0]}</p> : null}
    </div>
  );
}
