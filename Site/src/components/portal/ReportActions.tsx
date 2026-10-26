'use client';

import { useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { moderateBot, moderateServer, reopenReport, resolveReport } from '@/app/portal/actions';

type Props = {
  reportId: string;
  kind: string;
  status: string;
  /** The listing this report is about: a server or a bot (src/lib/reports.ts). */
  targetKind: 'server' | 'bot';
  targetId: string;
  targetStatus: string;
  ownerBanned: boolean;
  openRelated: number;
  resolution: string | null;
  handledBy: string | null;
  handledAt: string | null;
};

export function ReportActions(p: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [outcome, setOutcome] = useState<'action' | 'dismiss'>('action');
  const [serverAction, setServerAction] = useState<'none' | 'hide' | 'remove'>(p.kind === 'REMOVAL' ? 'remove' : 'hide');
  const [banOwner, setBanOwner] = useState(false);
  const [closeRelated, setCloseRelated] = useState(p.openRelated > 0);
  const [note, setNote] = useState('');

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });

  if (p.status !== 'OPEN') {
    return (
      <div className="card p-5">
        <h2 className="font-bold">{p.status === 'ACTIONED' ? 'Actioned' : 'Dismissed'}</h2>
        <p className="mt-1 text-sm text-ink-3">
          by @{p.handledBy ?? '?'} {p.handledAt && `on ${new Date(p.handledAt).toLocaleString('en-GB')}`}
        </p>
        {p.resolution && <p className="mt-4 text-sm text-ink-2 rounded-xl bg-raised border border-line p-3 whitespace-pre-wrap">{p.resolution}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => reopenReport(p.reportId))}>
            <RotateCcw size={14} /> Reopen
          </button>
          {(p.targetStatus === 'HIDDEN' || p.targetStatus === 'REMOVED') && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={pending}
              onClick={() => run(() => (p.targetKind === 'bot' ? moderateBot({ botId: p.targetId, action: 'restore' }) : moderateServer({ serverId: p.targetId, action: 'restore' })))}
            >
              Restore listing
            </button>
          )}
        </div>
        <Feedback msg={msg} />
      </div>
    );
  }

  const isRemoval = p.kind === 'REMOVAL';

  return (
    <form
      className="card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => resolveReport({ reportId: p.reportId, outcome, serverAction: outcome === 'action' ? serverAction : 'none', banOwner: outcome === 'action' && banOwner, closeRelated, note }));
      }}
    >
      <h2 className="font-bold">Decide</h2>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-line bg-raised p-1">
        {(['action', 'dismiss'] as const).map((o) => (
          <button key={o} type="button" onClick={() => setOutcome(o)} className={clsx('relative h-9 rounded-lg text-sm font-semibold', outcome === o ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}>
            {outcome === o && <motion.span layoutId="outcome" className="absolute inset-0 rounded-lg bg-surface-3" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{o === 'action' ? (isRemoval ? 'Approve' : 'Take action') : isRemoval ? 'Deny' : 'Dismiss'}</span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {outcome === 'action' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <fieldset className="mt-5 space-y-1.5">
              <legend className="label">Listing</legend>
              {(
                [
                  ['hide', 'Hide', 'Out of search; owner can still see and edit it.'],
                  ['remove', 'Remove', 'Taken down for good; can’t be re-listed.'],
                  ['none', 'Leave it', 'No change to the listing.'],
                ] as const
              ).map(([k, label, body]) => (
                <label key={k} className={clsx('flex gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors', serverAction === k ? 'border-accent/60 bg-accent-soft' : 'border-line hover:border-line-strong')}>
                  <input type="radio" name="sa" className="mt-1 accent-[var(--accent)]" checked={serverAction === k} onChange={() => setServerAction(k)} />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-ink-3">{body}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {!p.ownerBanned && (
              <label className="mt-4 flex items-center gap-2.5 text-sm text-ink-2 cursor-pointer">
                <input type="checkbox" className="size-4 accent-[var(--danger)]" checked={banOwner} onChange={(e) => setBanOwner(e.target.checked)} />
                Also ban the lister and hide all their listings
              </label>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {p.openRelated > 0 && (
        <label className="mt-3 flex items-center gap-2.5 text-sm text-ink-2 cursor-pointer">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={closeRelated} onChange={(e) => setCloseRelated(e.target.checked)} />
          Close the other {p.openRelated} open report{p.openRelated === 1 ? '' : 's'} on this {p.targetKind} too
        </label>
      )}

      <label className="block mt-5">
        <span className="label">Note</span>
        <textarea className="field text-sm" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={outcome === 'action' ? 'Shown to the owner on hidden/removed listings' : 'Why it’s fine (staff only)'} />
      </label>

      <button className={clsx('btn w-full mt-4', outcome === 'action' && serverAction === 'remove' ? 'btn-danger' : 'btn-primary')} disabled={pending}>
        {pending ? 'Saving…' : outcome === 'dismiss' ? (isRemoval ? 'Deny request' : 'Dismiss report') : serverAction === 'remove' ? 'Remove listing' : serverAction === 'hide' ? 'Hide listing' : 'Mark actioned'}
      </button>
      <Feedback msg={msg} />
    </form>
  );
}

function Feedback({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={clsx('mt-3 text-sm inline-flex items-center gap-1.5', msg.ok ? 'text-ok' : 'text-danger')}>
          {msg.ok && <Check size={14} />}
          {msg.text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
