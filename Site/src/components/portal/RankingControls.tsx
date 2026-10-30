'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import clsx from 'clsx';
import {
  rebuildRanking,
  saveCommentSettings,
  saveRankingSettings,
  setCommentsEnabled,
  setRankingAffects,
  setRankingEnabled,
} from '@/app/portal/actions';
import type { CommentsConfig } from '@/lib/comments';
import { factorAsHours, SIGNALS, type RankingConfig, type Signal } from '@/lib/ranking-fields';
import type { ListingKind } from '@/lib/pro-fields';

/* ------------------------------------------------------------------ switches */

export function RankingSwitches({ cfg }: { cfg: RankingConfig }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ?? '') : (r.error ?? ''));
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={clsx('btn', cfg.enabled ? 'btn-danger' : 'btn-primary')} disabled={pending} onClick={() => run(() => setRankingEnabled(!cfg.enabled))}>
        {cfg.enabled ? 'Turn scoring off' : 'Turn scoring on'}
      </button>
      <button
        className={clsx('btn', cfg.affectsRanking ? 'btn-secondary' : 'btn-primary')}
        disabled={pending || !cfg.enabled}
        onClick={() => {
          if (!cfg.affectsRanking && !confirm('Let Active sort the boards? Owners who only self-bump a quiet listing will drop. Worth an announcement first.')) return;
          run(() => setRankingAffects(!cfg.affectsRanking));
        }}
      >
        {cfg.affectsRanking ? 'Back to watch-only' : 'Let it sort the boards'}
      </button>
      <button className="btn btn-ghost" disabled={pending} onClick={() => run(rebuildRanking)}>
        Rebuild every score
      </button>
      {msg && <span className="text-[13px] text-ink-3">{msg}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ the numbers */

type Field = { key: keyof RankingConfig; label: string; hint: string; min: number; max: number; step?: number; unit?: string };

const NUMBERS: Field[] = [
  { key: 'halfLifeHours', label: 'Half-life', hint: 'Activity is worth half as much after this long. Everything else is measured against it.', min: 6, max: 720, unit: 'h' },
  { key: 'windowDays', label: 'Window', hint: 'How far back a rebuild looks. A speed setting - past ~10 half-lives nothing measurable is left.', min: 3, max: 90, unit: 'd' },
  { key: 'diversityK', label: 'Diversity shrink', hint: 'The K in actors / (actors + K). Higher punishes a listing with few distinct people harder.', min: 0, max: 20, step: 0.5 },
  { key: 'sizeCoefficient', label: 'Size weight', hint: 'The c in 1 + c x log10(members + 1). A weak prior that bigger is a safer click.', min: 0, max: 0.5, step: 0.01 },
  { key: 'proBoost', label: 'Pro boost', hint: 'What a YapBoard Pro plan multiplies the activity term by.', min: 1, max: 2, step: 0.05 },
  { key: 'minAccountAgeHours', label: 'Account age to count', hint: 'Under this, activity counts at a quarter. 0 is off.', min: 0, max: 720, unit: 'h' },
  { key: 'ringDamping', label: 'Ring damping', hint: 'Not wired up yet. 0 computes the overlap without subtracting anything.', min: 0, max: 1, step: 0.05 },
];

const BOARDS: ListingKind[] = ['server', 'bot', 'client'];
const SIGNAL_LABEL: Record<Signal, string> = { review: 'Review', reply: 'Reply', bump: 'Bump', vote: 'Vote', listed: 'Listed' };

/**
 * The weights, with each one shown as the age it is worth.
 *
 * The conversion is the whole point of this screen. A weight is meaningless on its own - they sit inside a
 * log of a sum, so doubling all of them changes nothing - but "a reply now is worth a review from 4.5 days
 * ago" is a claim anybody can agree or disagree with. If the sentence sounds wrong, the number is wrong.
 */
export function RankingSettings({ initial, canEdit }: { initial: RankingConfig; canEdit: boolean }) {
  const [cfg, setCfg] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);
  const H = cfg.halfLifeHours;

  const asAge = (hours: number) => (Math.abs(hours) < 36 ? `${Math.round(hours)}h` : `${(hours / 24).toFixed(1)} days`);

  return (
    <form
      className="card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveRankingSettings(cfg);
          setMsg(r.ok ? r.message : r.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NUMBERS.map((f) => (
          <label key={f.key} className="block">
            <span className="label">{f.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="field"
                disabled={!canEdit}
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                value={cfg[f.key] as number}
                onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })}
              />
              {f.unit && <span className="text-xs text-ink-3">{f.unit}</span>}
            </div>
            <span className="mt-1 block text-[11.5px] leading-snug text-ink-3">{f.hint}</span>
            {f.key === 'proBoost' && (
              <span className="mt-1 block text-[11.5px] font-semibold text-accent">
                = {asAge(factorAsHours(cfg.proBoost, H))} of freshness
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-sm font-bold">Weights</h3>
        <p className="mt-1 text-[12px] text-ink-3">
          Per board, because the boards do not offer the same signals - a client cannot be voted on. “Worth” is the age at which a top-weighted review ties with
          this signal posted now.
        </p>
        <div className="mt-4 space-y-5">
          {BOARDS.map((board) => (
            <div key={board}>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">{board}s</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {SIGNALS.map((sig) => {
                  const row = cfg.weights[board][sig];
                  const top = Math.max(...SIGNALS.map((x) => cfg.weights[board][x].w));
                  const worth = row.w > 0 && top > 0 ? asAge(H * Math.log2(top / row.w)) : '-';
                  return (
                    <div key={sig} className="rounded-lg border border-line bg-raised p-2.5">
                      <div className="text-[12px] font-semibold">{SIGNAL_LABEL[sig]}</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input
                          type="number"
                          aria-label={`${SIGNAL_LABEL[sig]} weight`}
                          className="field h-8 text-[13px]"
                          disabled={!canEdit}
                          min={0}
                          max={1000}
                          value={row.w}
                          onChange={(e) =>
                            setCfg({ ...cfg, weights: { ...cfg.weights, [board]: { ...cfg.weights[board], [sig]: { ...row, w: Number(e.target.value) } } } })
                          }
                        />
                        <input
                          type="number"
                          aria-label={`${SIGNAL_LABEL[sig]} cap per person`}
                          title="Most events from one person on one listing that count"
                          className="field h-8 w-14 text-[13px]"
                          disabled={!canEdit}
                          min={0}
                          max={100}
                          value={row.cap}
                          onChange={(e) =>
                            setCfg({ ...cfg, weights: { ...cfg.weights, [board]: { ...cfg.weights[board], [sig]: { ...row, cap: Number(e.target.value) } } } })
                          }
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-ink-3">worth {worth}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {canEdit ? (
        <div className="mt-6 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!dirty || pending}>
            {pending ? 'Saving…' : 'Save and re-rank'}
          </button>
          {msg && <span className="text-[13px] text-ink-3">{msg}</span>}
        </div>
      ) : (
        <p className="mt-6 text-[13px] text-ink-3">Admins change these.</p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ reviews */

type CField = { key: keyof CommentsConfig; label: string; hint: string; min: number; max: number; unit?: string };

const COMMENT_NUMBERS: CField[] = [
  { key: 'minAccountAgeHours', label: 'Account age to post', hint: 'Hours since their first YapBoard login. 0 is off.', min: 0, max: 720, unit: 'h' },
  { key: 'cooldownMinutes', label: 'Wait between posts', hint: 'Per person, per listing.', min: 0, max: 1440, unit: 'min' },
  { key: 'maxPerUserPerDay', label: 'Per person a day', hint: 'Across the whole board.', min: 1, max: 200 },
  { key: 'maxPerNetworkPerDay', label: 'Per network a day', hint: 'Every account on one connection together.', min: 1, max: 500 },
  { key: 'editGraceMinutes', label: 'Silent edit window', hint: 'Inside this an edit is a typo. Outside it the row is marked as edited.', min: 0, max: 1440, unit: 'min' },
];

export function CommentSettings({ initial, canEdit }: { initial: CommentsConfig; canEdit: boolean }) {
  const [cfg, setCfg] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);

  return (
    <form
      className="card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCommentSettings(cfg);
          setMsg(r.ok ? r.message : r.error);
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Reviews and replies</h3>
        <button
          type="button"
          className={clsx('btn btn-sm', initial.enabled ? 'btn-danger' : 'btn-primary')}
          disabled={pending}
          onClick={() => {
            if (initial.enabled && !confirm('Pause reviews? The whole section disappears from every listing page. Nothing is deleted.')) return;
            start(async () => {
              const r = await setCommentsEnabled(!initial.enabled);
              setMsg(r.ok ? r.message : r.error);
            });
          }}
        >
          {initial.enabled ? 'Pause reviews' : 'Turn reviews on'}
        </button>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" checked={cfg.ratings} disabled={!canEdit} onChange={(e) => setCfg({ ...cfg, ratings: e.target.checked })} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          <span className="block text-[13px] font-semibold">Stars</span>
          <span className="block text-[11.5px] leading-snug text-ink-3">Off: replies only. Ratings already given stay in the database and come back when this does.</span>
        </span>
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMMENT_NUMBERS.map((f) => (
          <label key={f.key} className="block">
            <span className="label">{f.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="field"
                disabled={!canEdit}
                min={f.min}
                max={f.max}
                value={cfg[f.key] as number}
                onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })}
              />
              {f.unit && <span className="text-xs text-ink-3">{f.unit}</span>}
            </div>
            <span className="mt-1 block text-[11.5px] leading-snug text-ink-3">{f.hint}</span>
          </label>
        ))}
      </div>

      {canEdit && (
        <div className="mt-5 flex items-center gap-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!dirty || pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-[13px] text-ink-3">{msg}</span>}
        </div>
      )}
    </form>
  );
}
