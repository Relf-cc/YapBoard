// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import { ChevronsUp } from 'lucide-react';
import { BadgeMark } from '../Badge';

/** Grey placeholder rows under the highlighted one: [name width, summary width]. */
const ROWS = [
  ['42%', '58%'],
  ['34%', '48%'],
];

/**
 * House ad for YapBoard Pro. Fills a ServerCard slot in the grid, but leads with a small picture of the list
 * (a Pro server sitting on top) instead of a server icon, so it doesn't read as a listing.
 */
export function ProCard() {
  return (
    <aside aria-label="YapBoard Pro" className="group relative flex w-full flex-col card overflow-hidden hover:border-line-strong hover:-translate-y-[3px] transition-[border-color,translate] duration-300 ease-out-soft">
      {/* picture: the list, with a Pro server on top */}
      <div aria-hidden className="relative h-[108px] shrink-0 border-b border-line bg-raised px-5 pt-4 space-y-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-line-strong bg-surface px-2.5 py-2 transition-transform duration-300 ease-out-soft group-hover:-translate-y-0.5">
          <span className="size-6 shrink-0 rounded-md bg-surface-3" />
          <span className="h-2 w-[38%] rounded-full bg-ink-3/60" />
          <BadgeMark kind="PRO" size={13} seed="pro" />
          <ChevronsUp size={13} className="ml-auto text-accent" />
        </div>
        {ROWS.map(([a, b], i) => (
          <div key={i} className="flex items-center gap-2.5 px-2.5 opacity-60">
            <span className="size-5 shrink-0 rounded-md bg-surface-3" />
            <span className="h-1.5 rounded-full bg-surface-3" style={{ width: a }} />
            <span className="h-1.5 rounded-full bg-surface-2" style={{ width: b }} />
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 font-display text-[16.5px] font-bold leading-tight">
            YapBoard Pro <BadgeMark kind="PRO" size={16} seed="pro" />
          </h3>
          <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">Ad</span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2 line-clamp-2">Screenshots, a header style, more tags and a longer description - on your server, bot and client.</p>

        <div className="mt-auto pt-4">
          <Link href="/pro" className="btn btn-secondary btn-sm w-full">
            Learn more
          </Link>
        </div>
      </div>
    </aside>
  );
}
