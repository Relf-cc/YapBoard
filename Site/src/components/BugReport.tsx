'use client';

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Modal, ModalDone } from './Modal';

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

  if (state === 'done') {
    return (
      <Modal onClose={onClose}>
        <ModalDone title="Thanks, we’ve got it" onClose={onClose}>
          We read every bug report. This one goes straight to the people fixing things.
        </ModalDone>
      </Modal>
    );
  }

  return (
    <Modal title="Report a bug" sub="We’ll include the page you’re on and your browser." onClose={onClose}>
      <form onSubmit={submit} className="mt-5">
        <label className="block">
          <span className="label">Summary</span>
          <input className="field" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The bump button does nothing" required />
          {fields.title && <span className="mt-1 block text-xs text-danger">{fields.title}</span>}
        </label>

        <label className="mt-4 block">
          <span className="flex items-baseline justify-between">
            <span className="label">What happened</span>
            <span className="text-xs tabular-nums text-ink-3">{description.length}/3000</span>
          </span>
          <textarea
            className="field resize-none"
            rows={4}
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you did, what you expected, and what happened instead."
            required
          />
          {fields.description && <span className="mt-1 block text-xs text-danger">{fields.description}</span>}
        </label>

        {/* Honeypot: hidden with CSS, not type=hidden, so bots fill it in and Kern drops the report. */}
        <input name="_hp" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button disabled={!title.trim() || description.trim().length < 10 || state === 'sending'} className="btn btn-primary btn-sm">
            {state === 'sending' ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
