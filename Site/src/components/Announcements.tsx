'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Info, Megaphone, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import clsx from 'clsx';
import type { LiveAnnouncement, Tone } from '@/lib/announcements';
import { Modal } from './Modal';

/**
 * The site-wide banner and welcome dialog (src/lib/announcements.ts).
 *
 * The server already drops anything a logged-in person has closed. Logged-out visitors are remembered in
 * localStorage instead, so the first paint can still contain something they've seen: everything starts hidden
 * and appears once the browser has checked. That costs a frame, and avoids a banner flashing in and out.
 */

const KEY = 'yb:announcements:seen';

const TONE: Record<Tone, { bar: string; icon: typeof Info; chip: string }> = {
  accent: { bar: 'border-accent/35 bg-accent-soft text-accent', icon: Megaphone, chip: 'bg-accent text-on-accent' },
  info: { bar: 'border-[#5aa9e6]/35 bg-[#5aa9e6]/12 text-[#8fc6f5]', icon: Info, chip: 'bg-[#5aa9e6] text-[#06182a]' },
  warn: { bar: 'border-warn/35 bg-warn/12 text-warn', icon: TriangleAlert, chip: 'bg-warn text-[#241a05]' },
  danger: { bar: 'border-danger/35 bg-danger/12 text-[#ff8a8d]', icon: ShieldAlert, chip: 'bg-danger text-[#2a0708]' },
};

const read = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const write = (ids: string[]) => {
  try {
    // Keep the list short: old announcements are deleted server-side and never come back anyway.
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    // Private mode, or storage full. The notice shows again next visit, which is the safe way round.
  }
};

export function Announcements({ items, loggedIn }: { items: LiveAnnouncement[]; loggedIn: boolean }) {
  const [closed, setClosed] = useState<string[] | null>(null);

  useEffect(() => setClosed(loggedIn ? [] : read()), [loggedIn]);

  const dismiss = (id: string) => {
    setClosed((c) => [...(c ?? []), id]);
    if (loggedIn) {
      void fetch(`/api/announcements/${encodeURIComponent(id)}/seen`, { method: 'POST' }).catch(() => {});
    } else {
      write([...read(), id]);
    }
  };

  // Until the browser has read what was closed, show nothing.
  const visible = closed === null ? [] : items.filter((a) => !closed.includes(a.id));
  const banner = visible.find((a) => a.kind === 'BANNER');
  const modal = visible.find((a) => a.kind === 'MODAL');

  return (
    <>
      <AnimatePresence initial={false}>{banner && <Banner key={banner.id} a={banner} onClose={() => dismiss(banner.id)} />}</AnimatePresence>
      <AnimatePresence>{modal && <Welcome key={modal.id} a={modal} onClose={() => dismiss(modal.id)} />}</AnimatePresence>
    </>
  );
}

function Banner({ a, onClose }: { a: LiveAnnouncement; onClose: () => void }) {
  const tone = TONE[a.tone] ?? TONE.accent;
  const Icon = tone.icon;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className={clsx('border-b', tone.bar)}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Icon size={16} className="shrink-0" />
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <b className="font-semibold">{a.title}</b>
            <span className="text-ink-2"> - {a.body}</span>
          </p>
          {a.linkUrl && (
            <Link href={a.linkUrl} className="hidden shrink-0 items-center gap-1 text-[13px] font-semibold underline-offset-4 hover:underline sm:inline-flex">
              {a.linkLabel || 'Read more'}
              <ArrowRight size={13} />
            </Link>
          )}
          {a.dismissible && (
            <button onClick={onClose} aria-label="Hide this notice" className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100">
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Welcome({ a, onClose }: { a: LiveAnnouncement; onClose: () => void }) {
  const tone = TONE[a.tone] ?? TONE.accent;
  const Icon = tone.icon;
  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          className={clsx('mx-auto inline-flex size-12 items-center justify-center rounded-2xl', tone.chip)}
        >
          <Icon size={22} />
        </motion.span>
        <h2 className="mt-4 text-xl font-extrabold leading-snug text-ink">{a.title}</h2>
        <p className="mx-auto mt-2.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">{a.body}</p>
        <div className="mt-7 flex flex-col gap-2">
          {a.linkUrl && (
            <Link href={a.linkUrl} onClick={onClose} className="btn btn-primary">
              {a.linkLabel || 'Take a look'}
              <ArrowRight size={16} />
            </Link>
          )}
          <button onClick={onClose} className={clsx('btn', a.linkUrl ? 'btn-ghost btn-sm' : 'btn-secondary')}>
            {a.linkUrl ? 'Not now' : 'Got it'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
