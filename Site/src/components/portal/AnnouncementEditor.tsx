'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { deleteAnnouncement, saveAnnouncement, setAnnouncementActive } from '@/app/portal/actions';
import { AUDIENCES, KINDS, TONES, type Audience, type AnnouncementKind, type LiveAnnouncement, type Tone } from '@/lib/announcements';
import { Dropdown } from '../Dropdown';
import { Announcements } from '../Announcements';

export type EditorRow = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  tone: Tone;
  audience: Audience;
  newWithinHours: number;
  dismissible: boolean;
  active: boolean;
  startsAt: string;
  endsAt: string;
  author: string;
  seenBy: number;
};

const blank = (): EditorRow => ({
  id: '',
  kind: 'BANNER',
  title: '',
  body: '',
  linkUrl: '',
  linkLabel: '',
  tone: 'accent',
  audience: 'everyone',
  newWithinHours: 72,
  dismissible: true,
  active: false,
  startsAt: '',
  endsAt: '',
  author: '',
  seenBy: 0,
});

const options = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

/** Write, preview and publish the site-wide notices (src/lib/announcements.ts). */
export function AnnouncementEditor({ rows }: { rows: EditorRow[] }) {
  const [editing, setEditing] = useState<EditorRow | null>(null);
  return (
    <>
      <div className="flex justify-end">
        <button className="btn btn-primary btn-sm" onClick={() => setEditing(blank())}>
          <Plus size={15} strokeWidth={2.6} /> New announcement
        </button>
      </div>

      {editing && <Form key={editing.id || 'new'} row={editing} onDone={() => setEditing(null)} />}

      <div className="mt-6 space-y-3">
        {rows.length === 0 && !editing && <p className="card px-5 py-14 text-center text-sm text-ink-3">Nothing written yet.</p>}
        {rows.map((r) => (
          <Row key={r.id} row={r} onEdit={() => setEditing(r)} />
        ))}
      </div>
    </>
  );
}

function Row({ row, onEdit }: { row: EditorRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
    });

  return (
    <div className={clsx('card p-5', row.active && 'border-accent/40')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold', row.active ? 'border-ok/30 bg-ok/10 text-ok' : 'border-line-strong bg-surface-2 text-ink-3')}>
              {row.active ? 'Live' : 'Draft'}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-ink-3">{KINDS[row.kind]}</span>
            <span className="text-[11px] text-ink-3">· {AUDIENCES[row.audience]}</span>
            {row.kind === 'BANNER' && !row.dismissible && <span className="text-[11px] text-warn">· can’t be closed</span>}
            {row.seenBy > 0 && <span className="text-[11px] text-ink-3">· closed by {row.seenBy}</span>}
          </div>
          <h3 className="mt-1.5 font-bold">{row.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">{row.body}</p>
          {(row.startsAt || row.endsAt) && (
            <p className="mt-1.5 text-xs text-ink-3">
              {row.startsAt ? `From ${new Date(row.startsAt).toLocaleString('en-GB')}` : 'From now'}
              {row.endsAt ? ` until ${new Date(row.endsAt).toLocaleString('en-GB')}` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={onEdit}>
            Edit
          </button>
          <button className={clsx('btn btn-sm', row.active ? 'btn-secondary' : 'btn-primary')} disabled={pending} onClick={() => run(() => setAnnouncementActive({ id: row.id, active: !row.active }))}>
            {row.active ? 'Take down' : 'Publish'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={pending}
            aria-label="Delete"
            onClick={() => {
              if (confirm('Delete this announcement? It disappears from the site straight away.')) run(() => deleteAnnouncement(row.id));
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Form({ row, onDone }: { row: EditorRow; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(row);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  // A fresh id each time, so closing a preview can't make the next one think it's already been seen.
  const [preview, setPreview] = useState('');
  const set = <K extends keyof EditorRow>(k: K, val: EditorRow[K]) => setV((x) => ({ ...x, [k]: val }));

  const asLive: LiveAnnouncement = {
    id: preview,
    kind: v.kind,
    title: v.title || 'Your title',
    body: v.body || 'What you want people to know.',
    linkUrl: v.linkUrl || null,
    linkLabel: v.linkLabel || null,
    tone: v.tone,
    dismissible: v.kind === 'MODAL' ? true : v.dismissible,
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mt-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        start(async () => {
          const r = await saveAnnouncement({
            id: v.id || undefined,
            kind: v.kind,
            title: v.title,
            body: v.body,
            linkUrl: v.linkUrl || null,
            linkLabel: v.linkLabel || null,
            tone: v.tone,
            audience: v.audience,
            newWithinHours: v.newWithinHours,
            dismissible: v.dismissible,
            startsAt: v.startsAt || null,
            endsAt: v.endsAt || null,
          });
          if (!r.ok) return setError(r.error);
          router.refresh();
          onDone();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="label">Shown as</span>
          <Dropdown label="Shown as" value={v.kind} onChange={(x) => set('kind', x as AnnouncementKind)} options={options(KINDS)} />
          <span className="mt-1 block text-xs text-ink-3">{v.kind === 'MODAL' ? 'A dialog, once per person.' : 'A bar at the top of every page.'}</span>
        </label>
        <label className="block">
          <span className="label">Who sees it</span>
          <Dropdown label="Who sees it" value={v.audience} onChange={(x) => set('audience', x as Audience)} options={options(AUDIENCES)} />
          <span className="mt-1 block text-xs text-ink-3">Logged-out visitors always count as new.</span>
        </label>
        <label className="block">
          <span className="label">Colour</span>
          <Dropdown label="Colour" value={v.tone} onChange={(x) => set('tone', x as Tone)} options={options(TONES)} />
        </label>
        {v.audience === 'new' ? (
          <label className="block">
            <span className="label">“New” means</span>
            <div className="relative">
              <input type="number" min={1} max={8760} className="field pr-12 tabular-nums" value={v.newWithinHours} onChange={(e) => set('newWithinHours', Math.round(Number(e.target.value) || 1))} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">hours</span>
            </div>
            <span className="mt-1 block text-xs text-ink-3">Since their first login.</span>
          </label>
        ) : (
          <div />
        )}
      </div>

      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="label">Title</span>
          <input className="field" maxLength={120} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Bot listings are here" required />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between">
            <span className="label">Body</span>
            <span className="text-xs tabular-nums text-ink-3">{v.body.length}/1000</span>
          </span>
          <textarea className="field" rows={3} maxLength={1000} value={v.body} onChange={(e) => set('body', e.target.value)} placeholder="You can now list the bots you run, right alongside your servers." required />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="label">Link</span>
          <input className="field" value={v.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="/bots" />
          <span className="mt-1 block text-xs text-ink-3">A path like /bots, or a full https link.</span>
        </label>
        <label className="block">
          <span className="label">Link label</span>
          <input className="field" maxLength={40} value={v.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} placeholder="Take a look" />
        </label>
        <label className="block">
          <span className="label">Starts</span>
          <input type="datetime-local" className="field" value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Ends</span>
          <input type="datetime-local" className="field" value={v.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </label>
      </div>

      {v.kind === 'BANNER' && (
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={v.dismissible} onChange={(e) => set('dismissible', e.target.checked)} />
          <span>
            <span className="font-semibold text-ink">People can close it</span>
            <span className="block text-xs text-ink-3">Off: no close button, and it comes back on every page. Save that for things that really matter.</span>
          </span>
        </label>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
        <button type="button" className="btn btn-ghost btn-sm mr-auto" onClick={() => setPreview(`preview-${Date.now()}`)}>
          <Eye size={15} /> Preview
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Saving…' : v.id ? 'Save changes' : 'Create'}
        </button>
      </div>

      <AnimatePresence>
        {preview && (
          <div className="fixed inset-0 z-[70]" onClick={() => setPreview('')}>
            {/* The real components, so what staff see is what the site shows. */}
            <div className="absolute inset-x-0 top-0" onClick={(e) => e.stopPropagation()}>
              <Announcements items={[asLive]} loggedIn={false} />
            </div>
            {asLive.kind === 'BANNER' && <p className="absolute inset-x-0 top-24 text-center text-xs text-ink-3">Click anywhere to close the preview</p>}
          </div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
