'use client';

import { useTransition } from 'react';
import { moderateServer, moderateUser, setRole } from '@/app/portal/actions';

const ask = (q: string) => {
  const n = window.prompt(q);
  return n === null ? null : n.trim();
};

export function ServerModButtons({ serverId, status }: { serverId: string; status: string }) {
  const [pending, start] = useTransition();
  const act = (action: 'hide' | 'remove' | 'restore') => {
    const note = action === 'restore' ? '' : ask(action === 'hide' ? 'Why hide it? (the owner sees this)' : 'Why remove it? (the owner sees this)');
    if (note === null) return;
    start(async () => {
      const r = await moderateServer({ serverId, action, note });
      if (!r.ok) alert(r.error);
    });
  };
  return (
    <div className="inline-flex gap-1.5">
      {status === 'HIDDEN' || status === 'REMOVED' ? (
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => act('restore')}>
          Restore
        </button>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => act('hide')}>
          Hide
        </button>
      )}
      {status !== 'REMOVED' && (
        <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => act('remove')}>
          Remove
        </button>
      )}
    </div>
  );
}

export function UserModButtons({ userId, banned, role, canSetRole, self }: { userId: string; banned: boolean; role: string; canSetRole: boolean; self: boolean }) {
  const [pending, start] = useTransition();
  if (self) return <span className="text-xs text-ink-3">you</span>;
  return (
    <div className="inline-flex items-center gap-1.5">
      {canSetRole && (
        <select
          className="field h-8 w-28 text-xs"
          value={role}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as 'USER' | 'STAFF' | 'ADMIN';
            start(async () => {
              const r = await setRole({ userId, role: next });
              if (!r.ok) alert(r.error);
            });
          }}
        >
          <option value="USER">User</option>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
      )}
      {banned ? (
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => void (await moderateUser({ userId, action: 'unban' })))}>
          Unban
        </button>
      ) : (
        <button
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => {
            const note = ask('Ban reason? Their listings will be hidden.');
            if (note === null) return;
            start(async () => {
              const r = await moderateUser({ userId, action: 'ban', note });
              if (!r.ok) alert(r.error);
            });
          }}
        >
          Ban
        </button>
      )}
    </div>
  );
}
