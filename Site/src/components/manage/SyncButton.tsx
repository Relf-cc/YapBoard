'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from '../Tooltip';

/** Re-reads the server's name, icon and member count from Yapin'. */
export function SyncButton({ serverId }: { serverId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <Tooltip content={msg || 'Update name, icon and members from Yapin’'}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/servers/${serverId}/sync`, { method: 'POST' });
          const out = await res.json().catch(() => ({}));
          setMsg(res.ok ? 'Synced' : out.error || 'Sync failed');
          setBusy(false);
          if (res.ok) router.refresh();
        }}
      >
        <RefreshCw size={14} className={clsx(busy && 'animate-spin')} />
        {msg && !busy ? msg : 'Sync'}
      </button>
    </Tooltip>
  );
}
