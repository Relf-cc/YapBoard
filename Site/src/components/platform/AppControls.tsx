'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play } from 'lucide-react';
import { retireApp, setAppPaused } from '@/app/platform/actions';

/**
 * Pause, restart, retire. Pausing is the developer's own switch - the keys stay, the calls stop - so a
 * deployment gone wrong can be stopped without throwing away the key it was built around.
 */
export function AppControls({ appId, name, status, base }: { appId: string; name: string; status: string; base: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return window.alert(r.error);
      after ? after() : router.refresh();
    });

  if (status === 'SUSPENDED' || status === 'REVOKED') return null;

  return (
    <div className="inline-flex gap-1.5">
      {status === 'PAUSED' ? (
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => setAppPaused({ appId, paused: false }))}>
          <Play size={14} /> Resume
        </button>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => setAppPaused({ appId, paused: true }))}>
          <Pause size={14} /> Pause
        </button>
      )}
      <button
        className="btn btn-danger btn-sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Retire ${name}? Every key is revoked and the bot ID is freed. This can’t be undone.`)) return;
          run(() => retireApp(appId), () => router.push(`${base}/apps`));
        }}
      >
        Retire
      </button>
    </div>
  );
}
