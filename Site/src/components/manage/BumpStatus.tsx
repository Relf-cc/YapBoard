'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ChevronsUp } from 'lucide-react';
import clsx from 'clsx';
import { formatDuration } from '@/lib/format';
import { Tooltip } from '../Tooltip';

const COOLDOWN = 2 * 60 * 60 * 1000;

/** Countdown ring until the next bump. In dev (no bot) it doubles as a bump button. */
export function BumpStatus({ serverId, bumpedAt, canWebBump, compact }: { serverId: string; bumpedAt: string | null; canWebBump: boolean; compact?: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [last, setLast] = useState(bumpedAt);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLast(bumpedAt), [bumpedAt]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const left = last ? Math.max(0, new Date(last).getTime() + COOLDOWN - now) : 0;
  const ready = left === 0;
  const progress = 1 - left / COOLDOWN;

  async function bump() {
    setBusy(true);
    const res = await fetch(`/api/servers/${serverId}/bump`, { method: 'POST' });
    setBusy(false);
    if (res.ok) {
      setLast(new Date().toISOString());
      setNow(Date.now());
      router.refresh();
    }
  }

  const ring = (
    <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90 shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="9" fill="none" stroke="var(--surface-3)" strokeWidth="2.5" />
      <motion.circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke={ready ? 'var(--ok)' : 'var(--accent)'}
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: ready ? 1 : progress }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );

  if (ready && canWebBump) {
    return (
      <button onClick={bump} disabled={busy} className="btn btn-sm btn-secondary !border-ok/40 hover:!bg-ok/10 group">
        <ChevronsUp size={15} className="text-ok transition-transform group-hover:-translate-y-0.5" />
        {busy ? 'Bumping…' : 'Bump now'}
      </button>
    );
  }

  return (
    <Tooltip content={ready ? 'Type /bump in your server to move back to the top' : `Next bump at ${new Date(new Date(last!).getTime() + COOLDOWN).toLocaleTimeString(undefined, { timeStyle: 'short' })}`}>
      <div className={clsx('inline-flex items-center gap-2 text-[13px]', compact ? 'px-2' : '')}>
        {ring}
        <span className={ready ? 'text-ok font-medium' : 'text-ink-3 tabular-nums'}>{ready ? (compact ? 'Ready: /bump' : 'Ready to bump. Type /bump in your server') : `Bump in ${formatDuration(left)}`}</span>
      </div>
    </Tooltip>
  );
}
