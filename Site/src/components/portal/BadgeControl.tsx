'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Minus } from 'lucide-react';
import clsx from 'clsx';
import { setBadge } from '@/app/portal/actions';
import { Badge } from '../Badge';

const OPTIONS = [
  { value: 'NONE', title: 'No checkmark' },
  { value: 'VERIFIED', title: 'Verify (blue)' },
  { value: 'OFFICIAL', title: 'Make official (green)' },
] as const;

/** Three-way switch: none / verified / official. Saves on click. */
export function BadgeControl({ serverId, badge }: { serverId: string; badge: string | null }) {
  const [value, setValue] = useState(badge ?? 'NONE');
  const [pending, start] = useTransition();
  return (
    <div className={clsx('inline-flex gap-0.5 rounded-lg border border-line bg-raised p-0.5', pending && 'opacity-60')} role="radiogroup" aria-label="Checkmark">
      {OPTIONS.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            disabled={pending}
            onClick={() => {
              if (on) return;
              const prev = value;
              setValue(o.value);
              start(async () => {
                const r = await setBadge({ serverId, badge: o.value });
                if (!r.ok) {
                  setValue(prev);
                  alert(r.error);
                }
              });
            }}
            className="relative size-7 inline-flex items-center justify-center rounded-md"
          >
            {on && <motion.span layoutId={`badge-${serverId}`} className="absolute inset-0 rounded-md bg-surface-3" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />}
            <span className={clsx('relative transition-opacity', !on && 'opacity-40 hover:opacity-80')}>
              {o.value === 'NONE' ? <Minus size={14} className="text-ink-3" /> : <Badge kind={o.value} size={16} seed={serverId + o.value} tooltip={false} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
