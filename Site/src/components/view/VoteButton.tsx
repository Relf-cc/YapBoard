'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowBigUp } from 'lucide-react';
import clsx from 'clsx';
import { formatDuration } from '@/lib/format';

type Props = {
  serverId: string;
  /** The listing's accent, mixed into the confetti. */
  accent?: string;
  votes: number;
  /** Why this person can't vote, if they can't: login | own. Otherwise null. */
  blocked: 'login' | 'own' | null;
  /** ISO time they can vote again, if they voted recently. */
  nextAt: string | null;
};

export function VoteButton({ serverId, accent, votes: initialVotes, blocked, nextAt: initialNext }: Props) {
  const path = usePathname();
  const [votes, setVotes] = useState(initialVotes);
  const [nextAt, setNextAt] = useState(initialNext);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  /** Bumps on every successful vote; each value is one celebration. */
  const [party, setParty] = useState(0);
  const voted = !!nextAt && new Date(nextAt).getTime() > Date.now();

  const count = (
    <span className="relative inline-flex overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={votes} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
          {votes.toLocaleString()}
        </motion.span>
      </AnimatePresence>
    </span>
  );

  if (blocked === 'login') {
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn btn-secondary btn-lg">
        <ArrowBigUp size={18} /> Vote {count}
      </Link>
    );
  }

  async function vote() {
    setSending(true);
    setError('');
    const res = await fetch(`/api/servers/${serverId}/vote`, { method: 'POST' }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setSending(false);
    if (res?.ok) {
      setVotes(out.votes);
      setNextAt(out.nextAt);
      setParty((p) => p + 1);
      return;
    }
    if (out.nextAt) setNextAt(out.nextAt);
    setError(out.error || 'Couldn’t vote just now. Try again in a minute.');
  }

  const title = blocked === 'own' ? 'You can’t vote for your own server' : voted ? `You voted. Vote again in ${formatDuration(new Date(nextAt!).getTime() - Date.now())}.` : 'Vote for this server';

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={vote}
        disabled={sending || voted || blocked === 'own'}
        title={title}
        className={clsx('btn btn-lg', voted ? 'btn-secondary text-accent' : 'btn-secondary', 'disabled:cursor-default')}
      >
        <motion.span animate={voted ? { y: [0, -4, 0] } : { y: 0 }} transition={{ duration: 0.35 }} className="inline-flex">
          <ArrowBigUp size={18} className={clsx(voted && 'fill-current')} />
        </motion.span>
        {voted ? 'Voted' : 'Vote'} {count}
      </motion.button>
      {error && <p className="absolute left-0 top-full mt-1.5 w-max max-w-[80vw] text-xs text-danger">{error}</p>}
      <AnimatePresence>{party > 0 && <Celebration key={party} accent={accent} />}</AnimatePresence>
    </div>
  );
}

const COLOURS = ['#ff6b4a', '#ffb347', '#ffd166', '#ff8fab', '#7bdff2', '#b8f2a1'];
const PIECES = 34;

/** Confetti out of the button and a "+1" floating up. Just the "+1" for people who turn motion off. */
function Celebration({ accent }: { accent?: string }) {
  const calm = useReducedMotion();
  // Fixed per burst: random once, not on every render.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
        const speed = 70 + Math.random() * 110;
        return {
          x: Math.cos(angle) * speed,
          up: Math.sin(angle) * speed,
          fall: 60 + Math.random() * 90,
          spin: (Math.random() - 0.5) * 720,
          size: 5 + Math.random() * 5,
          round: i % 3 === 0,
          colour: accent && i % 4 === 0 ? accent : COLOURS[i % COLOURS.length],
          delay: Math.random() * 0.06,
          duration: 0.9 + Math.random() * 0.5,
        };
      }),
    [accent],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <motion.span
        className="absolute left-1/2 top-0 -translate-x-1/2 font-display text-lg font-extrabold text-accent"
        initial={{ y: 0, opacity: 0, scale: 0.6 }}
        animate={{ y: -34, opacity: [0, 1, 1, 0], scale: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
      >
        +1
      </motion.span>
      {!calm &&
        pieces.map((p, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ width: p.size, height: p.round ? p.size : p.size * 0.45, background: p.colour, borderRadius: p.round ? 999 : 1.5 }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: p.x, y: [0, p.up, p.up + p.fall], rotate: p.spin, opacity: [1, 1, 0] }}
            transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut', times: [0, 0.45, 1] }}
          />
        ))}
    </div>
  );
}
