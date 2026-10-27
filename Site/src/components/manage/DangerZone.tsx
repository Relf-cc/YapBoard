'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Trash2 } from 'lucide-react';

/** Each board's API prefix, and what the listing is called in the copy. */
const KINDS = {
  server: { path: 'servers', word: 'server' },
  bot: { path: 'bots', word: 'bot' },
  client: { path: 'clients', word: 'client' },
} as const;

export function DangerZone({ serverId, name, kind = 'server' }: { serverId: string; name: string; kind?: keyof typeof KINDS }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/${KINDS[kind].path}/${serverId}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) return router.push('/dashboard');
    const out = await res?.json().catch(() => ({}));
    setError(out?.error || 'Couldn’t delete the listing. Try again.');
    setBusy(false);
  }

  return (
    <section className="mt-12 rounded-2xl border border-danger/25 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">Delete listing</h2>
          <p className="mt-1 text-sm text-ink-3">Takes the page down and wipes its stats. {kind === 'client' ? 'Your client and its releases aren’t touched.' : <>Your Yapin’ {KINDS[kind].word} isn’t touched.</>}</p>
        </div>
        {!confirming && (
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>
      <AnimatePresence>
        {confirming && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="pt-5 flex flex-col sm:flex-row gap-2">
              <input className="field flex-1" placeholder={`Type “${name}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" disabled={typed !== name || busy} onClick={remove}>
                {busy ? 'Deleting…' : 'Delete for good'}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
