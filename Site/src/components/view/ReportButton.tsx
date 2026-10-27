'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Flag } from 'lucide-react';
import clsx from 'clsx';
import { ABUSE_REASONS, REMOVAL_REASONS, type ReportKind } from '@/lib/reports';
import { Modal, ModalDone } from '../Modal';

type Target = { kind: 'server' | 'bot' | 'client'; id: string; name: string };

/** The same dialog on all three boards; `target` decides which listing the report is filed against. */
export function ReportButton({ target, loggedIn }: { target: Target; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (!loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`} className="inline-flex items-center gap-1.5 hover:text-danger transition-colors">
        <Flag size={13} /> Report
      </Link>
    );
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 hover:text-danger transition-colors">
        <Flag size={13} /> Report
      </button>
      <AnimatePresence>{open && <ReportDialog target={target} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

/** Each board's API prefix, so the dialog doesn't grow a ternary chain per board. */
const REPORT_PATHS = { server: 'servers', bot: 'bots', client: 'clients' } as const;

const KINDS: { kind: ReportKind; label: string }[] = [
  { kind: 'ABUSE', label: 'Report abuse' },
  { kind: 'REMOVAL', label: 'Request removal' },
];

function ReportDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const [kind, setKind] = useState<ReportKind>('ABUSE');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const reasons = kind === 'ABUSE' ? ABUSE_REASONS : REMOVAL_REASONS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    const res = await fetch(`/api/${REPORT_PATHS[target.kind]}/${target.id}/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, reason, details }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setError(out.error || 'Something went wrong. Try again.');
      setState('idle');
      return;
    }
    setState('done');
  }

  if (state === 'done') {
    return (
      <Modal onClose={onClose}>
        <ModalDone title="Thanks, we’ve got it" onClose={onClose}>
          Staff review every report. We’ll act on it if it breaks the listing guidelines.
        </ModalDone>
      </Modal>
    );
  }

  return (
    <Modal title={`Report ${target.name}`} sub="Only YapBoard staff see reports." onClose={onClose}>
      <form onSubmit={submit} className="mt-5">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-raised p-1">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => {
                setKind(k.kind);
                setReason('');
              }}
              className={clsx('relative h-8 rounded-md text-[13px] font-semibold transition-colors', kind === k.kind ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
            >
              {kind === k.kind && <motion.span layoutId="report-kind" className="absolute inset-0 rounded-md bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{k.label}</span>
            </button>
          ))}
        </div>

        <fieldset className="mt-5">
          <legend className="label">What’s wrong?</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(reasons).map(([k, label]) => (
              <label
                key={k}
                className={clsx(
                  'cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50',
                  reason === k ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:border-line-strong',
                )}
              >
                <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 block">
          <span className="flex items-baseline justify-between">
            <span className="label">Details</span>
            <span className="text-xs tabular-nums text-ink-3">{details.length}/1500</span>
          </span>
          <textarea
            className="field resize-none"
            rows={3}
            maxLength={1500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={
              kind === 'ABUSE'
                ? 'What did you see? Links to messages help.'
                : target.kind === 'bot'
                  ? 'Anything that helps us check, like how you’re involved with the bot.'
                  : target.kind === 'client'
                    ? 'Anything that helps us check — where the download really goes, or what the build does.'
                    : 'Anything that helps us check, like who you are in the server.'
            }
          />
        </label>

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button disabled={!reason || details.trim().length < 10 || state === 'sending'} className="btn btn-primary btn-sm">
            {state === 'sending' ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
