'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { createPlatformInvite, moderatePlatformApp, revokePlatformInvite, setPlatformMember } from '@/app/portal/actions';
import { SCOPES, SCOPE_ORDER, type Scope } from '@/lib/platform-scopes';
import { CopyField } from '../CopyField';
import { Dropdown } from '../Dropdown';

const ask = (q: string) => {
  const n = window.prompt(q);
  return n === null ? null : n.trim();
};

/** The scope chips, the one control staff and developers share. Read-only unless `onChange` is given. */
function ScopePicker({ value, onChange, disabled }: { value: Scope[]; onChange?: (next: Scope[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SCOPE_ORDER.map((s) => {
        const on = value.includes(s);
        return (
          <button
            key={s}
            type="button"
            disabled={disabled || !onChange}
            onClick={() => onChange?.(on ? value.filter((x) => x !== s) : [...value, s])}
            title={SCOPES[s].blurb}
            className={clsx('chip h-6 text-[11.5px]', on && 'chip-active', !onChange && 'pointer-events-none')}
          >
            {s}
          </button>
        );
      })}
      {!value.length && !onChange && <span className="text-xs text-ink-3">none</span>}
    </div>
  );
}

const EXPIRY = [
  { value: '14', label: 'Expires in 14 days' },
  { value: '30', label: 'Expires in 30 days' },
  { value: '7', label: 'Expires in 7 days' },
  { value: '0', label: 'No expiry' },
];
const LIMITS = [1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: `${n} app${n === 1 ? '' : 's'}` }));

/** Writes an invite and shows the code once, to be passed on by hand. Nothing is emailed or DMed. */
export function InviteComposer({ canGrantScopes }: { canGrantScopes: boolean }) {
  const [note, setNote] = useState('');
  const [forUserId, setForUserId] = useState('');
  const [appLimit, setAppLimit] = useState('2');
  const [expiresInDays, setExpires] = useState('14');
  const [scopes, setScopes] = useState<Scope[]>(['bump', 'listing']);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        setCode('');
        start(async () => {
          const r = await createPlatformInvite({ note, forUserId, appLimit: Number(appLimit), scopes, expiresInDays: Number(expiresInDays) });
          if (!r.ok) return setError(r.error);
          setCode(r.code ?? '');
          setNote('');
          setForUserId('');
          router.refresh();
        });
      }}
    >
      <h2 className="font-bold">Invite a developer</h2>
      <p className="mt-1 text-[13px] text-ink-3">The code is shown once here and handed over by you - that’s what keeps the program invite-only.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="inote">
            Who it’s for
          </label>
          <input id="inote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="@ellie - writes Yapper.js bots, asked about /bump" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="ifor">
            Lock to a Yapin’ user ID <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <input id="ifor" value={forUserId} onChange={(e) => setForUserId(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="9876543210" className="field font-mono" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Dropdown name="limit" label="App limit" size="md" className="w-40" value={appLimit} options={LIMITS} onChange={setAppLimit} />
        <Dropdown name="expiry" label="Expiry" size="md" className="w-48" value={expiresInDays} options={EXPIRY} onChange={setExpires} />
      </div>

      <div className="mt-4">
        <span className="label">Scopes {canGrantScopes ? '' : '(admins only)'}</span>
        <ScopePicker value={scopes} onChange={canGrantScopes ? (v) => setScopes(v) : undefined} disabled={!canGrantScopes} />
      </div>

      {code && (
        <div className="mt-4">
          <span className="label">Hand this over</span>
          <CopyField value={code} />
        </div>
      )}
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      <button className="btn btn-primary mt-5" disabled={pending}>
        <Plus size={15} /> {pending ? 'Writing…' : 'Create invite'}
      </button>
    </form>
  );
}

export function InviteActions({ id, redeemed }: { id: string; redeemed: boolean }) {
  const [pending, start] = useTransition();
  if (redeemed) return <span className="text-xs text-ink-3">used</span>;
  return (
    <button
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await revokePlatformInvite(id);
          if (!r.ok) window.alert(r.error);
        })
      }
    >
      Withdraw
    </button>
  );
}

/** Suspend, restore, and - for admins - the member's ceiling of scopes and apps. */
export function MemberControls({ userId, status, scopes, appLimit, isAdmin }: { userId: string; status: string; scopes: Scope[]; appLimit: number; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const run = (input: Parameters<typeof setPlatformMember>[0]) =>
    start(async () => {
      const r = await setPlatformMember(input);
      if (!r.ok) window.alert(r.error);
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isAdmin ? <ScopePicker value={scopes} disabled={pending} onChange={(next) => run({ userId, action: 'scopes', scopes: next })} /> : <ScopePicker value={scopes} />}
      {isAdmin && (
        <button
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() => {
            const n = ask(`How many apps may they register? (currently ${appLimit})`);
            if (n === null) return;
            const appLimitNext = Math.round(Number(n));
            if (!Number.isFinite(appLimitNext) || appLimitNext < 1) return window.alert('That isn’t a number');
            run({ userId, action: 'limit', appLimit: appLimitNext });
          }}
        >
          Limit
        </button>
      )}
      {status === 'SUSPENDED' ? (
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run({ userId, action: 'restore' })}>
          Restore
        </button>
      ) : (
        <button
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => {
            const n = ask('Why suspend them? (they see this on their overview)');
            if (n === null) return;
            run({ userId, action: 'suspend', note: n });
          }}
        >
          Suspend
        </button>
      )}
    </div>
  );
}

export function PlatformAppActions({ appId, status }: { appId: string; status: string }) {
  const [pending, start] = useTransition();
  if (status === 'REVOKED') return <span className="text-xs text-ink-3">retired</span>;
  const run = (action: 'suspend' | 'restore', note?: string) =>
    start(async () => {
      const r = await moderatePlatformApp({ appId, action, note });
      if (!r.ok) window.alert(r.error);
    });

  return status === 'SUSPENDED' ? (
    <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run('restore')}>
      Restore
    </button>
  ) : (
    <button
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() => {
        const n = ask('Why suspend this app? (the developer sees this)');
        if (n === null) return;
        run('suspend', n);
      }}
    >
      Suspend
    </button>
  );
}
