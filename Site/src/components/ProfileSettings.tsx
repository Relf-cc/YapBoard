'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';

const MAX_BIO = 200;

/**
 * The bio, the link and the private switch, on the dashboard.
 *
 * The switch hides the aggregate - the counters and everything somebody runs in one place - and not the
 * person: their listings still name their owner on their own pages, which was never private. Worth saying
 * in the UI, because "private profile" otherwise sounds like a promise this cannot keep.
 */
export function ProfileSettings({ userId, initial }: { userId: string; initial: { bio: string | null; link: string | null; profileHidden: boolean } }) {
  const router = useRouter();
  const [bio, setBio] = useState(initial.bio ?? '');
  const [link, setLink] = useState(initial.link ?? '');
  const [hidden, setHidden] = useState(initial.profileHidden);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const dirty = bio !== (initial.bio ?? '') || link !== (initial.link ?? '') || hidden !== initial.profileHidden;

  return (
    <form
      id="profile"
      className="card scroll-mt-24 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('saving');
        setError('');
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bio: bio.trim() || null, link: link.trim() || null, profileHidden: hidden }),
        }).catch(() => null);
        const out = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok) {
          setError(out.error || 'Couldn’t save that just now.');
          setState('idle');
          return;
        }
        setState('saved');
        router.refresh();
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-extrabold">Your profile</h2>
        <Link href={`/profile/${userId}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
          View it
          <ArrowUpRight size={13} />
        </Link>
      </div>
      <p className="mt-1 text-[13px] text-ink-3">Shown at /profile/{userId}, and linked from everything you write.</p>

      <label className="mt-5 block">
        <span className="flex items-baseline justify-between">
          <span className="label">About you</span>
          <span className="text-xs tabular-nums text-ink-3">
            {bio.length}/{MAX_BIO}
          </span>
        </span>
        <textarea className="field resize-none" rows={2} maxLength={MAX_BIO} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line about you. Optional." />
      </label>

      <label className="mt-4 block">
        <span className="label">A link</span>
        <input className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" inputMode="url" />
      </label>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          <span className="block text-sm font-semibold">Keep my profile private</span>
          <span className="block text-[12.5px] leading-relaxed text-ink-3">
            Hides your counters, badges and the list of everything you run, and keeps the page out of search results. Your listings still show you as their owner on
            their own pages.
          </span>
        </span>
      </label>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={!dirty || state === 'saving'} className={clsx('btn btn-primary btn-sm')}>
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {state === 'saved' && !dirty && <span className="text-[13px] text-ok">Saved</span>}
      </div>
    </form>
  );
}
