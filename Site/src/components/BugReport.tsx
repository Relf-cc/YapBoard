'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bug, CheckCircle2, X } from 'lucide-react';

/**
 * Bug reports go straight from the browser to a Kern stream (a public stream: it only takes posts from the site's
 * origin, rate limits per visitor and drops honeypot hits). No secret is involved, so none can leak.
 * Baked in at build time; without it the button doesn't show.
 */
const STREAM = process.env.NEXT_PUBLIC_BUG_REPORT_URL;

export function BugReportButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  if (!STREAM) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        Report a bug
      </button>
      <AnimatePresence>{open && <BugReportDialog stream={STREAM} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function BugReportDialog({ stream, onClose }: { stream: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hp, setHp] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

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
    setFields({});
    const res = await fetch(stream, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), page: location.href, browser: navigator.userAgent, _hp: hp }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res || !out.ok) {
      setFields(out.fields || {});
      setError(
        res?.status === 429
          ? `You’ve sent a few reports already. Try again in ${out.retryAfter > 90 ? `${Math.ceil(out.retryAfter / 60)} minutes` : `${out.retryAfter || 60} seconds`}.`
          : out.fields
            ? 'Check the fields above.'
            : 'Couldn’t send that. Try again in a minute.',
      );
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
        aria-labelledby="bug-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl text-left"
      >
        <button onClick={onClose} className="absolute right-4 top-4 btn btn-ghost btn-sm px-2" aria-label="Close">
          <X size={18} />
        </button>

        {state === 'done' ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-ok" strokeWidth={1.8} />
            <h2 className="mt-4 text-xl font-bold text-ink">Thanks, we’ve got it</h2>
            <p className="mt-2 text-sm text-ink-3">We read every bug report. This one goes straight to the people fixing things.</p>
            <button onClick={onClose} className="btn btn-secondary mt-6">
              Close
            </button>
          </motion.div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="bug-title" className="flex items-center gap-2 text-xl font-bold text-ink pr-8">
              <Bug size={20} className="text-accent" /> Report a bug
            </h2>
            <p className="mt-1.5 text-sm text-ink-3">Something broken or acting weird? Tell us. We’ll include the page you’re on and your browser.</p>

            <label className="block mt-5">
              <span className="label">Summary</span>
              <input className="field" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The bump button does nothing" required />
              {fields.title && <span className="mt-1 block text-xs text-danger">{fields.title}</span>}
            </label>

            <label className="block mt-4">
              <span className="label">What happened</span>
              <textarea
                className="field"
                rows={5}
                maxLength={3000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What you did, what you expected, and what happened instead."
                required
              />
              {fields.description && <span className="mt-1 block text-xs text-danger">{fields.description}</span>}
              <span className="mt-1 block text-right text-xs text-ink-3 tabular-nums">{description.length}/3000</span>
            </label>

            {/* Honeypot: hidden with CSS, not type=hidden, so bots fill it in and Kern drops the report. */}
            <input
              name="_hp"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
              <button disabled={!title.trim() || description.trim().length < 10 || state === 'sending'} className="btn btn-primary">
                {state === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
