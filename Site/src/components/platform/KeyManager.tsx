'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Plus, ShieldAlert } from 'lucide-react';
import { createKey, revokeKey } from '@/app/platform/actions';
import { CopyField } from '../CopyField';

type Key = { id: string; label: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

/**
 * The app's keys. A new one is shown here, once, and never again: only its hash is stored, so this panel is
 * the single moment the secret exists outside the caller's own config.
 */
export function KeyManager({ appId, keys, canMint }: { appId: string; keys: Key[]; canMint: boolean }) {
  const [label, setLabel] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  const live = keys.filter((k) => !k.revokedAt);

  return (
    <section className="card overflow-hidden">
      <header className="flex h-14 items-center justify-between border-b border-line px-5">
        <h2 className="font-bold">Keys</h2>
        <span className="text-xs text-ink-3">
          {live.length} live, {keys.length - live.length} revoked
        </span>
      </header>

      {fresh && (
        <div className="border-b border-line bg-accent-soft/40 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound size={15} className="text-accent" /> Your new key - copy it now
          </p>
          <CopyField value={fresh} className="mt-2.5" />
          <p className="mt-2 text-[12.5px] text-ink-3">
            This is the only time it’s shown. Nothing here stores it, so if it’s lost you mint another and revoke this one.
          </p>
        </div>
      )}

      <ul className="divide-y divide-line">
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
            <code className="font-mono text-sm text-ink-2">{k.prefix}…</code>
            <span className="min-w-0 flex-1 truncate text-sm">{k.label || <span className="text-ink-3">no label</span>}</span>
            <span className="text-xs text-ink-3">made {when(k.createdAt)}</span>
            <span className="w-28 text-xs text-ink-3">{k.lastUsedAt ? `used ${when(k.lastUsedAt)}` : 'never used'}</span>
            {k.revokedAt ? (
              <span className="inline-flex h-5 items-center rounded-full border border-line-strong bg-surface-2 px-2 text-[11px] font-semibold text-ink-3">Revoked</span>
            ) : (
              <button
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm('Revoke this key? Anything using it stops at the next call.')) return;
                  setError('');
                  start(async () => {
                    const r = await revokeKey({ appId, keyId: k.id });
                    if (!r.ok) return setError(r.error);
                    router.refresh();
                  });
                }}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
        {keys.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-ink-3">No keys yet. Mint one and your bot can start calling.</li>
        )}
      </ul>

      <div className="border-t border-line px-5 py-4">
        {canMint ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              setFresh(null);
              start(async () => {
                const r = await createKey({ appId, label });
                if (!r.ok) return setError(r.error);
                if ('secret' in r && r.secret) setFresh(r.secret);
                setLabel('');
                router.refresh();
              });
            }}
          >
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Label - prod, staging, my laptop" className="field sm:flex-1" />
            <button className="btn btn-secondary" disabled={pending}>
              <Plus size={14} /> {pending ? 'Minting…' : 'Mint a key'}
            </button>
          </form>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <ShieldAlert size={15} className="text-warn" /> Keys can’t be minted while this app isn’t active.
          </p>
        )}
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </div>
    </section>
  );
}
