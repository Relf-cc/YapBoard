'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Plus, Send, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { cancelBroadcast, deleteBroadcast, saveBroadcast, sendBroadcast } from '@/app/portal/actions';

export type BroadcastRow = {
  id: string;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  status: string;
  author: string;
  createdAt: string;
  progress: { total: number; sent: number; failed: number; waiting: number };
};

const STATUS: Record<string, [string, string]> = {
  DRAFT: ['Draft', 'border-line-strong bg-surface-2 text-ink-3'],
  SENDING: ['Sending', 'border-accent/30 bg-accent-soft text-accent'],
  SENT: ['Sent', 'border-ok/30 bg-ok/10 text-ok'],
  CANCELLED: ['Stopped', 'border-danger/30 bg-danger/10 text-[#ff8a8d]'],
};

/** Write a global message and send it through the bot (src/lib/broadcasts.ts). */
export function BroadcastComposer({ rows, reach, canSend }: { rows: BroadcastRow[]; reach: number; canSend: boolean }) {
  const [writing, setWriting] = useState(false);
  return (
    <>
      <div className="flex justify-end">
        <button className="btn btn-primary btn-sm" onClick={() => setWriting((w) => !w)}>
          <Plus size={15} strokeWidth={2.6} /> New broadcast
        </button>
      </div>

      {writing && <Composer reach={reach} onDone={() => setWriting(false)} />}

      <div className="mt-6 space-y-3">
        {rows.length === 0 && !writing && <p className="card px-5 py-14 text-center text-sm text-ink-3">Nothing sent yet.</p>}
        {rows.map((r) => (
          <Row key={r.id} row={r} reach={reach} canSend={canSend} />
        ))}
      </div>
    </>
  );
}

function Row({ row, reach, canSend }: { row: BroadcastRow; reach: number; canSend: boolean }) {
  const [pending, start] = useTransition();
  const [label, style] = STATUS[row.status] ?? [row.status, 'border-line-strong bg-surface-2 text-ink-3'];
  const { total, sent, failed, waiting } = row.progress;
  const done = total ? Math.round(((sent + failed) / total) * 100) : 0;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
      else if (r.message) alert(r.message);
    });

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold', style)}>{label}</span>
            <span className="text-[11px] text-ink-3">
              by @{row.author} · {new Date(row.createdAt).toLocaleString('en-GB')}
            </span>
          </div>
          <h3 className="mt-1.5 font-bold">{row.title}</h3>
          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-ink-3">{row.body}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {row.status === 'DRAFT' && canSend && (
            <button
              className="btn btn-primary btn-sm"
              disabled={pending}
              onClick={() => {
                if (confirm(`Send “${row.title}” to ${reach} server${reach === 1 ? '' : 's'}? This can’t be taken back.`)) run(() => sendBroadcast(row.id));
              }}
            >
              <Send size={14} /> Send to {reach}
            </button>
          )}
          {row.status === 'SENDING' && (
            <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => cancelBroadcast(row.id))}>
              Stop
            </button>
          )}
          {row.status !== 'SENDING' && (
            <button
              className="btn btn-danger btn-sm"
              aria-label="Delete"
              disabled={pending}
              onClick={() => {
                if (confirm('Delete this broadcast and its delivery log?')) run(() => deleteBroadcast(row.id));
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${done}%` }} transition={{ duration: 0.5 }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 text-xs tabular-nums text-ink-3">
            <span className="text-ok">{sent} sent</span>
            {failed > 0 && <span className="text-danger">{failed} failed</span>}
            {waiting > 0 && <span>{waiting} waiting</span>}
            <span className="ml-auto">{total} total</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Composer({ reach, onDone }: { reach: number; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ title: '', body: '', linkUrl: '', linkLabel: '' });
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const set = (k: keyof typeof v, val: string) => setV((x) => ({ ...x, [k]: val }));

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mt-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        start(async () => {
          const r = await saveBroadcast({ title: v.title, body: v.body, linkUrl: v.linkUrl || null, linkLabel: v.linkLabel || null });
          if (!r.ok) return setError(r.error);
          router.refresh();
          onDone();
        });
      }}
    >
      <p className="text-sm text-ink-3">
        This is posted by the bot in <b className="text-ink-2">{reach}</b> server{reach === 1 ? '' : 's'} — each one in the channel it last used <code className="font-mono">/bump</code> in. Saved as a draft first; sending is a separate step.
      </p>

      <label className="mt-4 block">
        <span className="label">Title</span>
        <input className="field" maxLength={120} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Bot listings are live" required />
      </label>
      <label className="mt-4 block">
        <span className="flex items-baseline justify-between">
          <span className="label">Message</span>
          <span className="text-xs tabular-nums text-ink-3">{v.body.length}/1500</span>
        </span>
        <textarea className="field" rows={5} maxLength={1500} value={v.body} onChange={(e) => set('body', e.target.value)} placeholder="You can now list the bots you run on YapBoard, right alongside your servers." required />
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Button link</span>
          <input className="field" value={v.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="https://yapboard.dev/bots" />
          <span className="mt-1 block text-xs text-ink-3">Yapin’ only allows https links on buttons.</span>
        </label>
        <label className="block">
          <span className="label">Button label</span>
          <input className="field" maxLength={40} value={v.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} placeholder="Browse bots" />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-5">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save draft'}
        </button>
      </div>
    </motion.form>
  );
}
