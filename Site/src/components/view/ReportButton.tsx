'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Flag, X } from 'lucide-react';
import clsx from 'clsx';
import { ABUSE_REASONS, REMOVAL_REASONS, type ReportKind } from '@/lib/reports';

export function ReportButton({ serverId, serverName, loggedIn }: { serverId: string; serverName: string; loggedIn: boolean }) {
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
      <AnimatePresence>{open && <ReportDialog serverId={serverId} serverName={serverName} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function ReportDialog({ serverId, serverName, onClose }: { serverId: string; serverName: string; onClose: () => void }) {
  const [kind, setKind] = useState<ReportKind>('ABUSE');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const reasons = kind === 'ABUSE' ? ABUSE_REASONS : REMOVAL_REASONS;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    const res = await fetch(`/api/servers/${serverId}/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, reason, details }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(out.error || 'Something went wrong');
      setState('idle');
      return;
    }
    setState('done');
  }

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 btn btn-ghost btn-sm px-2" aria-label="Close">
          <X size={18} />
        </button>

        {state === 'done' ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-ok" strokeWidth={1.8} />
            <h2 className="mt-4 text-xl font-bold">Thanks, we’ve got it</h2>
            <p className="mt-2 text-sm text-ink-3">Staff review every report. We’ll act on it if it breaks the listing guidelines.</p>
            <button onClick={onClose} className="btn btn-secondary mt-6">
              Close
            </button>
          </motion.div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="report-title" className="text-xl font-bold pr-8">
              Report {serverName}
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-raised p-1 border border-line">
              {(['ABUSE', 'REMOVAL'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setReason('');
                  }}
                  className={clsx('relative h-9 rounded-lg text-sm font-semibold transition-colors', kind === k ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
                >
                  {kind === k && <motion.span layoutId="report-tab" className="absolute inset-0 rounded-lg bg-surface-3" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <span className="relative">{k === 'ABUSE' ? 'Report abuse' : 'Request removal'}</span>
                </button>
              ))}
            </div>

            <fieldset className="mt-5 space-y-1.5">
              <legend className="label">What’s wrong?</legend>
              {Object.entries(reasons).map(([k, label]) => (
                <label
                  key={k}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition-colors',
                    reason === k ? 'border-accent/60 bg-accent-soft text-ink' : 'border-line hover:border-line-strong text-ink-2',
                  )}
                >
                  <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="accent-[var(--accent)]" />
                  {label}
                </label>
              ))}
            </fieldset>

            <label className="block mt-5">
              <span className="label">Details</span>
              <textarea
                className="field"
                rows={4}
                maxLength={1500}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={kind === 'ABUSE' ? 'What did you see? Links to messages or screenshots help a lot.' : 'Anything that helps us check, like who you are in the server.'}
              />
              <span className="mt-1 block text-right text-xs text-ink-3 tabular-nums">{details.length}/1500</span>
            </label>

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
              <button disabled={!reason || details.trim().length < 10 || state === 'sending'} className="btn btn-primary">
                {state === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
