'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Lock, Plus, UserMinus, Users } from 'lucide-react';
import { Avatar } from '../Avatar';
import type { ListingKind } from '@/lib/pro-fields';

/**
 * Co-managers: who else may edit this listing.
 *
 * Its own panel rather than a field in the form, because adding somebody takes effect immediately and
 * shouldn't wait for a Save that might never be pressed - and because it's owner-only, so it has to be
 * able to disappear for a co-manager who is allowed to edit everything else on the page.
 */

export type Manager = { userId: string; username: string; displayName: string | null; avatarUrl: string | null };

export function Managers({
  kind,
  listingId,
  managers,
  max,
  isOwner,
}: {
  kind: ListingKind;
  listingId: string;
  managers: Manager[];
  /** 0 means this listing isn't on a plan that allows any. */
  max: number;
  /** Co-managers can edit the listing but not change who else can, so they see this read-only. */
  isOwner: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();

  const full = managers.length >= max;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    setError('');
    setBusy('add');
    const res = await fetch('/api/listings/managers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, listingId, username: name }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setError(out.fields?.username?.[0] || out.error || 'Couldn’t add them. Try again in a moment.');
      return;
    }
    setUsername('');
    startTransition(() => router.refresh());
  }

  async function remove(userId: string) {
    setError('');
    setBusy(userId);
    const res = await fetch('/api/listings/managers', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, listingId, userId }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setError(out.error || 'Couldn’t remove them. Try again in a moment.');
      return;
    }
    startTransition(() => router.refresh());
  }

  // Nothing to say to a co-manager when there's nobody else listed.
  if (!isOwner && managers.length === 0) return null;

  return (
    <section className="card mt-10 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Users size={18} className="text-accent" />
          Co-managers
        </h2>
        {max > 0 && isOwner && (
          <span className="text-xs tabular-nums text-ink-3">
            {managers.length}/{max}
          </span>
        )}
      </div>

      <div className="px-6 py-5">
        {managers.length > 0 ? (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {managers.map((m) => (
                <motion.li key={m.userId} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <Avatar src={m.avatarUrl} name={m.displayName || m.username} id={m.userId} size={34} round />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{m.displayName || m.username}</div>
                      <div className="truncate text-[12.5px] text-ink-3">@{m.username}</div>
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => remove(m.userId)}
                        disabled={!!busy}
                        aria-label={`Remove ${m.username}`}
                        className="btn btn-secondary btn-sm shrink-0 px-2.5 text-ink-3 hover:text-danger"
                      >
                        {busy === m.userId ? <Loader2 size={15} className="animate-spin" /> : <UserMinus size={15} />}
                      </button>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : max > 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-3">
            Nobody yet. Add someone from your team and they can edit this listing and bump it &mdash; but not delete it, change who else can edit, or see your billing.
          </p>
        ) : null}

        {isOwner && max === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong bg-raised/60 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
                <Lock size={15} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Co-managers</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
                  Let someone else on your team edit this listing, so it doesn&rsquo;t go stale the day you hand over. They can&rsquo;t delete it or touch billing.
                </p>
                <Link href="/pro" className="btn btn-secondary btn-sm mt-3">
                  See YapBoard Pro
                </Link>
              </div>
            </div>
          </div>
        )}

        {isOwner && max > 0 && !full && (
          <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
            <input
              className="field min-w-0 flex-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Their YapBoard username"
              maxLength={40}
              aria-label="Username to add as a co-manager"
            />
            <button type="submit" disabled={!!busy || !username.trim()} className="btn btn-primary btn-sm shrink-0">
              {busy === 'add' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Add
            </button>
          </form>
        )}

        {isOwner && max > 0 && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
            {full
              ? `That's all ${max}. Remove somebody to add another.`
              : 'They need to have signed in to YapBoard at least once, so there’s an account to add.'}
          </p>
        )}

        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 text-sm text-danger">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
