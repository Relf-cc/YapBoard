'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Lock } from 'lucide-react';
import clsx from 'clsx';
import { createApp, updateApp } from '@/app/platform/actions';
import { SCOPES, type Scope } from '@/lib/platform-scopes';

type App = { id: string; botId: string; name: string; summary: string; contactUrl: string | null; scopes: Scope[] };

/**
 * Register a bot, or edit the one that's registered. The bot ID is set once: it's what a bump made through
 * the API is traced back to, so changing it would quietly re-point an app's whole history.
 */
export function AppForm({ base, app, allowed, scopeOrder }: { base: string; app?: App; allowed: Scope[]; scopeOrder: Scope[] }) {
  const [botId, setBotId] = useState(app?.botId ?? '');
  const [name, setName] = useState(app?.name ?? '');
  const [summary, setSummary] = useState(app?.summary ?? '');
  const [contactUrl, setContactUrl] = useState(app?.contactUrl ?? '');
  const [scopes, setScopes] = useState<Scope[]>(app?.scopes ?? []);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const toggle = (s: Scope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    start(async () => {
      const r = app ? await updateApp({ appId: app.id, name, summary, contactUrl, scopes }) : await createApp({ botId, name, summary, contactUrl, scopes });
      if (!r.ok) return setError(r.error);
      if (!app && 'appId' in r && r.appId) return router.push(`${base}/apps/${r.appId}`);
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <form className="card max-w-2xl p-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="botId">
            Bot ID
          </label>
          <input
            id="botId"
            value={botId}
            onChange={(e) => setBotId(e.target.value.replace(/[^0-9]/g, ''))}
            disabled={!!app}
            placeholder="1049283746152839"
            inputMode="numeric"
            className="field font-mono disabled:opacity-60"
          />
          <p className="mt-1.5 text-[12px] text-ink-3">{app ? 'Set once, and kept - your calls are traced back to it.' : 'The ID people paste into Server settings → Bots.'}</p>
        </div>
        <div>
          <label className="label" htmlFor="name">
            App name
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Yapbot" maxLength={60} className="field" />
          <p className="mt-1.5 text-[12px] text-ink-3">Usually just your bot’s name.</p>
        </div>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="summary">
          What it does with the commands <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={140}
          placeholder="/bump and a server finder in my community bot"
          className="field"
        />
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="contact">
          Where to reach you about it <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input id="contact" value={contactUrl} onChange={(e) => setContactUrl(e.target.value)} placeholder="https://yapin.gg/invite/…" className="field" />
        <p className="mt-1.5 text-[12px] text-ink-3">A support server or issue tracker. We use it before we suspend anything.</p>
      </div>

      <fieldset className="mt-6">
        <legend className="label">Scopes</legend>
        <div className="grid gap-2">
          {scopeOrder.map((key) => {
            const may = allowed.includes(key);
            const on = scopes.includes(key);
            return (
              <button
                key={key}
                type="button"
                disabled={!may}
                onClick={() => toggle(key)}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                  !may ? 'cursor-not-allowed border-line bg-raised opacity-60' : on ? 'border-accent-line bg-accent-soft' : 'border-line-strong bg-raised hover:border-accent-line',
                )}
              >
                <span className={clsx('mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border', on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong')}>
                  {!may ? <Lock size={11} className="text-ink-3" /> : on ? <Check size={13} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {SCOPES[key].label}
                    <code className="font-mono text-[11px] text-ink-3">{key}</code>
                    <span className="kbd">{SCOPES[key].command}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{may ? SCOPES[key].blurb : 'Not on your account. Ask staff if your bot needs it.'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
      <div className="mt-6 flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending || !name.trim() || (!app && botId.length < 5)}>
          {pending ? 'Saving…' : app ? 'Save changes' : 'Register app'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-ok">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
