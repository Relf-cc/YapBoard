'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import clsx from 'clsx';

type T = { name: string; count: number };

export function TagBrowser({ tags }: { tags: T[] }) {
  const [q, setQ] = useState('');
  const [order, setOrder] = useState<'popular' | 'az'>('popular');
  const max = tags[0]?.count ?? 1;

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, '');
    const list = t ? tags.filter((x) => x.name.includes(t)) : tags;
    return order === 'az' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [q, order, tags]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tags" className="field pl-10" aria-label="Filter tags" />
        </label>
        <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-line bg-raised p-1 w-full sm:w-56">
          {(['popular', 'az'] as const).map((o) => (
            <button key={o} onClick={() => setOrder(o)} className={clsx('relative h-9 rounded-lg text-sm font-semibold', order === o ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}>
              {order === o && <motion.span layoutId="tag-order" className="absolute inset-0 rounded-lg bg-surface-3" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{o === 'popular' ? 'Popular' : 'A–Z'}</span>
            </button>
          ))}
        </div>
      </div>

      <motion.ul layout className="mt-6 flex flex-wrap gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.slice(0, 600).map((t) => {
            // Bigger chips for bigger tags, on a gentle log scale.
            const weight = Math.log(t.count + 1) / Math.log(max + 1);
            return (
              <motion.li key={t.name} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}>
                <Link
                  href={`/servers?tag=${encodeURIComponent(t.name)}`}
                  className="group inline-flex items-baseline gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 hover:border-accent/50 hover:bg-accent-soft transition-colors"
                  style={{ fontSize: `${13 + weight * 5}px` }}
                >
                  <span className="text-accent font-bold">#</span>
                  <span className="font-semibold text-ink group-hover:text-ink">{t.name}</span>
                  <span className="text-[12px] text-ink-3 tabular-nums">{t.count}</span>
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
      {!shown.length && <p className="mt-10 text-center text-ink-3">No tags match “{q}”.</p>}
    </div>
  );
}
