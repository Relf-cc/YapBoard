'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';

/** Filters sit in a sidebar on desktop; on phones they fold away behind a button so results come first. */
export function FilterPanel({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="lg:hidden btn btn-secondary w-full justify-between">
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={16} />
          Filters
          {active > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-on-accent text-[11px] font-bold inline-flex items-center justify-center">{active}</span>}
        </span>
        <ChevronDown size={16} className={clsx('transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div className={clsx('space-y-7 pt-6 lg:pt-0 lg:block', open ? 'block' : 'hidden')}>{children}</div>
    </aside>
  );
}
