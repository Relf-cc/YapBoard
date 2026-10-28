'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Terminal } from 'lucide-react';
import { redeem } from '@/app/platform/actions';
import { LogoMark } from '../Logo';

/**
 * What everyone who isn't in the program sees. The code goes in here rather than in a link, so an invite can
 * be handed over in a DM without a URL that admits whoever it gets forwarded to.
 */
export function InviteGate({ username, siteUrl, termsHref }: { username: string; siteUrl: string; termsHref: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-16">
      <div className="dots pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="w-full max-w-lg rise">
        <div className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <span className="font-display text-[19px] font-bold tracking-tight">
            YapBoard <span className="ml-1 font-semibold text-ink-3">Platform</span>
          </span>
        </div>

        <h1 className="mt-6 text-[30px] font-extrabold leading-tight">YapBoard commands, inside your bot</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          The platform is an invite-only program for Yapin’ bot developers. Members put YapBoard’s commands - bumping, listing lookups, search - in
          front of their own users, with a key of their own and usage they can see.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          It’s invited rather than open because these calls act on other people’s listings: a bump moves a real server up a real board, so the bot
          sending it has to be one we can name and reach.
        </p>

        <form
          className="card mt-8 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            start(async () => {
              const r = await redeem(code);
              if (!r.ok) return setError(r.error);
              router.refresh();
            });
          }}
        >
          <label className="label" htmlFor="invite">
            Invite code
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="invite"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="YB-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              className="field font-mono tracking-[0.08em] uppercase sm:flex-1"
            />
            <button className="btn btn-primary" disabled={pending || code.trim().length < 8}>
              <KeyRound size={15} />
              {pending ? 'Checking…' : 'Join'}
            </button>
          </div>
          {error && <p className="mt-2.5 text-[13px] text-danger">{error}</p>}
          <p className="mt-3 text-[13px] text-ink-3">
            You’re signed in as <b className="text-ink-2">@{username}</b>. An invite can be tied to one account, so redeem it with the same one you
            build your bot under.
          </p>
          <p className="mt-2 text-[13px] text-ink-3">
            Redeeming accepts the{' '}
            <Link href={termsHref} className="underline decoration-line hover:text-ink transition-colors">
              platform terms
            </Link>
            . Worth reading first — they say what your keys may do, and what ends a membership.
          </p>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-3">
          <span className="inline-flex items-center gap-2">
            <Terminal size={14} className="text-accent" />
            No invite? List your bot first - that’s where we look.
          </span>
          <a href={`${siteUrl}/bots/add`} className="underline decoration-line hover:text-ink transition-colors">
            List a bot
          </a>
          <a href={siteUrl} className="underline decoration-line hover:text-ink transition-colors">
            Back to YapBoard
          </a>
        </div>
      </div>
    </div>
  );
}
