'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import clsx from 'clsx';
import { restoreVotes, revokeVotes, saveVotingSettings, setServerVoting, setVotingEnabled } from '@/app/portal/actions';
import type { VotingConfig } from '@/lib/votes';

const ask = (q: string) => {
  const n = window.prompt(q);
  return n === null ? null : n.trim();
};

/** The big switch. Any staff member can pause; that also stops votes moving servers. */
export function VotingSwitch({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className={clsx('btn', enabled ? 'btn-danger' : 'btn-primary')}
      disabled={pending}
      onClick={() => {
        if (enabled && !confirm('Pause voting? The vote button goes away and votes stop moving servers until it’s back on.')) return;
        start(async () => {
          const r = await setVotingEnabled(!enabled);
          if (!r.ok) alert(r.error);
        });
      }}
    >
      {enabled ? 'Pause voting' : 'Turn voting on'}
    </button>
  );
}

type Field = { key: keyof VotingConfig; label: string; hint: string; min?: number; max?: number; unit?: string };

const NUMBERS: Field[] = [
  { key: 'minutesPerVote', label: 'Boost per vote', hint: 'How far each vote moves a server forward in “recently bumped”.', min: 0, max: 30, unit: 'min' },
  { key: 'maxBoostMinutes', label: 'Most votes can add', hint: 'Between two bumps. Always less than a bump (2 hours).', min: 0, max: 110, unit: 'min' },
  { key: 'cooldownHours', label: 'Vote again after', hint: 'Per person, per server.', min: 1, max: 168, unit: 'h' },
  { key: 'maxPerUserPerDay', label: 'Votes per person a day', hint: 'Across all servers.', min: 1, max: 500 },
  { key: 'maxPerNetworkPerDay', label: 'Votes per network a day', hint: 'Every account on one IP together.', min: 1, max: 5000 },
  { key: 'minAccountAgeHours', label: 'Account age to vote', hint: 'Hours since their first YapBoard login. 0 is off.', min: 0, max: 720, unit: 'h' },
];

const SWITCHES: Field[] = [
  { key: 'affectsRanking', label: 'Votes move servers', hint: 'Off: votes are still taken and shown, but don’t change the order. Handy while checking for abuse.' },
  { key: 'onePerNetwork', label: 'One vote per network per server', hint: 'Stops many accounts on one IP voting for the same server.' },
];

/** Admins edit, other staff see the values. */
export function VotingSettings({ initial, canEdit }: { initial: VotingConfig; canEdit: boolean }) {
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
          const r = await saveVotingSettings(cfg);
          setMsg(r.ok ? r.message : r.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NUMBERS.map((f) => (
          <label key={f.key} className="block">
            <span className="label">{f.label}</span>
            <div className="relative">
              <input
                type="number"
                className="field pr-10 tabular-nums"
                min={f.min}
                max={f.max}
                disabled={!canEdit}
                value={cfg[f.key] as number}
                onChange={(e) => setCfg({ ...cfg, [f.key]: Math.round(Number(e.target.value) || 0) })}
              />
              {f.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">{f.unit}</span>}
            </div>
            <span className="mt-1 block text-xs text-ink-3">{f.hint}</span>
          </label>
        ))}
      </div>
      <div className="mt-5 space-y-3 border-t border-line pt-5">
        {SWITCHES.map((f) => (
          <label key={f.key} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-[var(--accent)]"
              disabled={!canEdit}
              checked={cfg[f.key] as boolean}
              onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.checked })}
            />
            <span>
              <span className="font-semibold text-ink">{f.label}</span>
              <span className="block text-xs text-ink-3">{f.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {canEdit ? (
        <div className="mt-5 flex items-center justify-end gap-3">
          {msg && <span className="text-sm text-ink-3">{msg}</span>}
          {dirty && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCfg(initial)}>
              Undo changes
            </button>
          )}
          <button className="btn btn-primary btn-sm" disabled={!dirty || pending}>
            {pending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      ) : (
        <p className="mt-5 text-xs text-ink-3">Only admins can change these. Any staff member can pause voting.</p>
      )}
    </form>
  );
}

/** Per server or per user: revoke their votes, restore what was revoked, and (servers) turn voting off. */
export function VoteTargetButtons({ kind, id, counted, revoked, votingOff }: { kind: 'server' | 'user'; id: string; counted: number; revoked: number; votingOff?: boolean }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
    });
  return (
    <div className="inline-flex flex-wrap justify-end gap-1.5">
      {counted > 0 && (
        <button
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => {
            const note = ask(`Revoke ${kind === 'server' ? 'all votes for this server' : 'all votes by this user'}? Why? (only staff see this)`);
            if (note !== null) run(() => revokeVotes({ kind, id, note }));
          }}
        >
          Revoke votes
        </button>
      )}
      {revoked > 0 && (
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => restoreVotes({ kind, id }))}>
          Restore {revoked}
        </button>
      )}
      {kind === 'server' && (
        <button
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => {
            const note = votingOff ? '' : ask('Turn voting off for this server? Why? (only staff see this)');
            if (note !== null) run(() => setServerVoting({ serverId: id, off: !votingOff, note }));
          }}
        >
          {votingOff ? 'Voting back on' : 'Voting off'}
        </button>
      )}
    </div>
  );
}
