'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Modal, ModalDone } from './Modal';

/**
 * Feedback goes straight from the browser to a Kern stream (a public stream: it only takes posts from the site's
 * origin, rate limits per visitor and drops honeypot hits). No secret is involved, so none can leak.
 * Baked in at build time; without it the button doesn't show.
 */
const STREAM = process.env.NEXT_PUBLIC_BUG_REPORT_URL;

export type FeedbackKind = 'bug' | 'idea';

/**
 * Copy for each kind. Both land in the same stream — suggestions are tagged in the summary rather than sent
 * somewhere new, so one stream still sees everything.
 */
const COPY = {
  bug: {
    cta: 'Report a bug',
    title: 'Report a bug',
    sub: 'We’ll include the page you’re on and your browser.',
    field: 'What happened',
    summaryHint: 'The bump button does nothing',
    bodyHint: 'What you did, what you expected, and what happened instead.',
    thanks: 'Thanks, we’ve got it',
    thanksBody: 'We read every bug report. This one goes straight to the people fixing things.',
    send: 'Send report',
    tag: '',
  },
  idea: {
    cta: 'Suggest something',
    title: 'Suggest something',
    sub: 'Ideas land with the same people who build the board.',
    field: 'Your idea',
    summaryHint: 'Let me sort servers by newest bump',
    bodyHint: 'What you’d like, and what it would let you do.',
    thanks: 'Thanks for the idea',
    thanksBody: 'We read every suggestion. Good ones turn up on the board sooner or later.',
    send: 'Send idea',
    tag: '[Suggestion] ',
  },
} as const satisfies Record<FeedbackKind, Record<string, string>>;

/** A bug report or a suggestion, in the same dialog. `children` replaces the default label. */
export function FeedbackButton({ kind = 'bug', className, children }: { kind?: FeedbackKind; className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!STREAM) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? COPY[kind].cta}
      </button>
      <AnimatePresence>{open && <FeedbackDialog kind={kind} stream={STREAM} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

/** The footer's long-standing button, unchanged. */
export function BugReportButton({ className }: { className?: string }) {
  return <FeedbackButton kind="bug" className={className} />;
}

function FeedbackDialog({ kind, stream, onClose }: { kind: FeedbackKind; stream: string; onClose: () => void }) {
  const copy = COPY[kind];
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
      body: JSON.stringify({ title: copy.tag + title.trim(), description: description.trim(), page: location.href, browser: navigator.userAgent, _hp: hp }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res || !out.ok) {
      setFields(out.fields || {});
      setError(
        res?.status === 429
          ? `You’ve sent a few of these already. Try again in ${out.retryAfter > 90 ? `${Math.ceil(out.retryAfter / 60)} minutes` : `${out.retryAfter || 60} seconds`}.`
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
        <ModalDone title={copy.thanks} onClose={onClose}>
          {copy.thanksBody}
        </ModalDone>
      </Modal>
    );
  }

  return (
    <Modal title={copy.title} sub={copy.sub} onClose={onClose}>
      <form onSubmit={submit} className="mt-5">
        <label className="block">
          <span className="label">Summary</span>
          <input className="field" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={copy.summaryHint} required />
          {fields.title && <span className="mt-1 block text-xs text-danger">{fields.title}</span>}
        </label>

        <label className="mt-4 block">
          <span className="flex items-baseline justify-between">
            <span className="label">{copy.field}</span>
            <span className="text-xs tabular-nums text-ink-3">{description.length}/3000</span>
          </span>
          <textarea
            className="field resize-none"
            rows={4}
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={copy.bodyHint}
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
            {state === 'sending' ? 'Sending…' : copy.send}
          </button>
        </div>
      </form>
    </Modal>
  );
}
