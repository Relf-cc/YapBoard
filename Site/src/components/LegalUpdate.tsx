'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ScrollText } from 'lucide-react';
import { LEGAL_DOCS, type LegalDocKey } from '@/lib/legal';

/**
 * The bottom-right toast that says the Terms or the Privacy policy changed (src/lib/legal.ts).
 *
 * What each person has read lives in their browser, keyed by the version numbers the two pages print in a
 * hidden marker at the top. Bump a version and everyone who has already read that page is told once. A first
 * visit writes the current numbers and says nothing: nobody gets told about a change they never saw. Reading
 * a page counts as seeing it, so the toast never sits on top of the page it's about.
 */

const KEY = 'yb:legal:seen';

type Seen = Partial<Record<LegalDocKey, number>>;

const read = (): Seen | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Seen) : null;
  } catch {
    // Private mode, or something else wrote nonsense here. Start again from scratch.
    return null;
  }
};

/** Record the live version of these pages as read. */
const mark = (keys: readonly LegalDocKey[]) => {
  const next: Seen = { ...read() };
  for (const doc of LEGAL_DOCS) if (keys.includes(doc.key)) next[doc.key] = doc.version;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Can't remember it. The toast shows again next visit, which is the safe way round.
  }
};

const ALL = LEGAL_DOCS.map((d) => d.key);

export function LegalUpdate() {
  const pathname = usePathname();
  const [stale, setStale] = useState<LegalDocKey[]>([]);

  useEffect(() => {
    const seen = read();
    if (!seen) {
      mark(ALL);
      setStale([]);
      return;
    }
    const here = LEGAL_DOCS.filter((d) => d.href === pathname).map((d) => d.key);
    if (here.length) mark(here);
    setStale(LEGAL_DOCS.filter((d) => !here.includes(d.key) && (seen[d.key] ?? 0) < d.version).map((d) => d.key));
  }, [pathname]);

  const docs = LEGAL_DOCS.filter((d) => stale.includes(d.key));
  const one = docs.length === 1 ? docs[0] : null;

  return (
    <AnimatePresence>
      {docs.length > 0 && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 460, damping: 34, delay: 0.5 }}
          className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[340px]"
        >
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-accent">
                <ScrollText size={26} />
              </span>
              <div className="min-w-0">
                <p className="text-[16.5px] font-bold leading-snug text-ink">
                  {one ? `${one.long} ${one.key === 'privacy' ? 'has' : 'have'} been updated` : 'Terms and Privacy have been updated'}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-ink-3">Worth a read - carrying on using YapBoard means you accept the new version.</p>
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2">
              {docs.map((d) => (
                <Link key={d.key} href={d.href} className="btn btn-secondary btn-sm">
                  {one ? 'Read more' : d.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  mark(stale);
                  setStale([]);
                }}
                className="btn btn-ghost btn-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
