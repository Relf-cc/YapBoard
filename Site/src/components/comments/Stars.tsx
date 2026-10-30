'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useId, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

const PATH = 'M12 3.6 14.6 9l5.9.8-4.3 4.1 1 5.9-5.2-2.8L6.8 19.8l1-5.9L3.5 9.8 9.4 9z';

/**
 * A rating, drawn.
 *
 * Fractional on purpose: the number under a listing is a blend with the board average (src/lib/ratings.ts),
 * so it lands on 4.3 far more often than on 4, and rounding it to whole stars would quietly throw away the
 * one thing that makes the blend honest.
 */
export function Stars({ value, size = 15, className }: { value: number; size?: number; className?: string }) {
  const id = useId();
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={clsx('inline-flex shrink-0 items-center', className)} aria-label={`${value.toFixed(1)} out of 5`}>
      <svg width={size * 5} height={size} viewBox="0 0 120 24" aria-hidden className="overflow-visible">
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="1" y1="0" y2="0">
            <stop offset={`${pct}%`} stopColor="var(--warn)" />
            <stop offset={`${pct}%`} stopColor="var(--line-strong)" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={PATH} transform={`translate(${i * 24} 0)`} fill={`url(#${id}-fill)`} />
        ))}
      </svg>
    </span>
  );
}

/** The picker in the review form. Hover previews, click sets, and it is a real radio group underneath. */
export function StarPicker({ value, onChange, disabled }: { value: number | null; onChange: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const label = ['', 'Bad', 'Poor', 'Fine', 'Good', 'Great'][shown] ?? '';
  return (
    <div className="flex items-center gap-2.5">
      <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5`}
            disabled={disabled}
            whileTap={{ scale: 0.86 }}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:hover:scale-100"
          >
            <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
              <path d={PATH} fill={n <= shown ? 'var(--warn)' : 'var(--line-strong)'} className="transition-[fill] duration-150" />
            </svg>
          </motion.button>
        ))}
      </div>
      <span className="text-[13px] font-semibold text-ink-3 tabular-nums">{label}</span>
    </div>
  );
}
