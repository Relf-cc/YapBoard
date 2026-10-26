'use client';

import { useTransition } from 'react';
import { moderateBot, moderateServer, moderateUser, setBotServerCount, setRole } from '@/app/portal/actions';
import { Dropdown } from '../Dropdown';

const ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'ADMIN', label: 'Admin' },
];

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

/** The same three actions for a bot listing, plus the server count, which nothing reports automatically. */
export function BotModButtons({ botId, status, serverCount }: { botId: string; status: string; serverCount: number }) {
  const [pending, start] = useTransition();
  const act = (action: 'hide' | 'remove' | 'restore') => {
    const note = action === 'restore' ? '' : ask(action === 'hide' ? 'Why hide it? (the lister sees this)' : 'Why remove it? (the lister sees this)');
    if (note === null) return;
    start(async () => {
      const r = await moderateBot({ botId, action, note });
      if (!r.ok) alert(r.error);
    });
  };
  return (
    <div className="inline-flex gap-1.5">
      <button
        className="btn btn-ghost btn-sm"
        disabled={pending}
        onClick={() => {
          const n = ask(`How many servers is this bot in? (currently ${serverCount})`);
          if (n === null) return;
          const count = Math.round(Number(n));
          if (!Number.isFinite(count) || count < 0) return alert('That isn’t a number');
          start(async () => {
            const r = await setBotServerCount({ botId, count });
            if (!r.ok) alert(r.error);
          });
        }}
      >
        Servers
      </button>
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
        <Dropdown
          label="Role"
          size="sm"
          className="w-28"
          value={role}
          disabled={pending}
          options={ROLES}
          onChange={(v) => {
            const next = v as 'USER' | 'STAFF' | 'ADMIN';
            start(async () => {
              const r = await setRole({ userId, role: next });
              if (!r.ok) alert(r.error);
            });
          }}
        />
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
