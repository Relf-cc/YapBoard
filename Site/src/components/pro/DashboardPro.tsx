'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, CreditCard, Loader2, Minus, Plus } from 'lucide-react';
import clsx from 'clsx';
import { ProMark } from '../Badge';
import type { ListingKind } from '@/lib/pro-fields';

/**
 * The Pro controls on the dashboard: one strip for the plan, one small button per listing.
 *
 * The manage page already has `ProPanel`, which does the same two things for a single listing. This
 * exists because the dashboard is where the question actually gets asked - an owner with six listings
 * and three slots is deciding *between* them, and answering that by opening six manage pages in turn is
 * the kind of thing people simply don't do, so slots sit unused and the plan looks like it did nothing.
 *
 * Assigning is free, instant and reversible, so it happens inline. Buying is not, so it doesn't: every
 * control here that costs money is a link to /pro, where the stepper shows the total before you commit.
 * A dashboard button that silently adds a pound a month to somebody's bill is a support ticket.
 */

/** Both controls talk to the same endpoint; this is the half that doesn't vary. */
async function slots(method: 'POST' | 'DELETE', body: object): Promise<string | null> {
  const res = await fetch('/api/billing/slots', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const out = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? null : out.error || 'Something went wrong. Try again in a moment.';
}

/**
 * A date both the server and the browser render identically.
 *
 * This is a client component, so it renders twice - once into the HTML, once on hydration - and a bare
 * `toLocaleDateString()` would read the server's locale and timezone the first time and the viewer's the
 * second. Pinning both makes it one string. UTC rather than local because a renewal date is Stripe's, and
 * Stripe's day is UTC.
 */
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export type PlanSummary = {
  active: boolean;
  grace: boolean;
  capacity: number;
  used: number;
  spare: number;
  overflow: number;
  extraSlots: number;
  cycle: string | null;
  until: string | null;
  endingAt: string | null;
};

/** The plan, across the top of the dashboard. Drawn only for somebody who has one. */
export function ProPlanStrip({ plan }: { plan: PlanSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function portal() {
    setError('');
    setBusy(true);
    const res = await fetch('/api/billing/portal', { method: 'POST' }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !out.url) {
      setBusy(false);
      setError(out.error || 'Couldn’t open the billing portal.');
      return;
    }
    window.location.href = out.url;
  }

  return (
    <div className="card mt-8 p-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProMark size={26} seed="dashboard" blurb="Your plan. Each slot covers one listing." />
          <div className="min-w-0">
            <div className="font-display text-[17px] font-bold leading-tight">YapBoard Pro</div>
            <div className="mt-0.5 text-[13px] text-ink-3">
              {plan.used} of {plan.capacity} {plan.capacity === 1 ? 'slot' : 'slots'} in use
              {plan.spare > 0 && <span className="text-accent"> · {plan.spare} spare</span>}
              {plan.endingAt ? (
                <> · ends {day(plan.endingAt)}</>
              ) : plan.until ? (
                <> · renews {day(plan.until)}</>
              ) : null}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/pro#price" className="btn btn-secondary btn-sm">
            <Plus size={14} /> Add a listing slot
          </Link>
          <button type="button" onClick={portal} disabled={busy} className="btn btn-ghost btn-sm">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Manage billing
          </button>
        </div>
      </div>

      {/* The two states worth interrupting for: a payment that's failing, and listings that aren't covered. */}
      {plan.grace && (
        <Note tone="warn">
          A payment hasn’t gone through. Stripe is retrying it, and your Pro perks stay on meanwhile - updating your card under “Manage billing” is the quickest way to settle it.
        </Note>
      )}
      {plan.overflow > 0 && (
        <Note tone="warn">
          {plan.overflow} {plan.overflow === 1 ? 'listing is' : 'listings are'} over your plan’s capacity, so their Pro fields are switched off. Nothing has been deleted - take another
          listing off Pro to free a slot, or add one.
        </Note>
      )}

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 text-sm text-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Note({ tone, children }: { tone: 'warn'; children: React.ReactNode }) {
  return (
    <div className={clsx('mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-relaxed', tone === 'warn' && 'border-warn/30 bg-warn/10 text-warn')}>
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * One listing's Pro control, for the row it belongs to.
 *
 * Deliberately quiet when there is nothing useful to offer: an owner with no plan, or no slot to spare,
 * gets no button here at all rather than a disabled one or a sales pitch on every row. The place to be
 * sold Pro is /pro; the place to be told your plan is full is the strip above, once.
 */
export function ProToggle({ kind, listingId, covered, canAssign, removed }: { kind: ListingKind; listingId: string; covered: boolean; canAssign: boolean; removed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();

  // Staff removed it: it can never come back, so it must never be something anybody pays to decorate.
  if (removed || (!covered && !canAssign)) return null;

  async function toggle() {
    setError('');
    setBusy(true);
    const problem = await slots(covered ? 'DELETE' : 'POST', { kind, listingId });
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={covered ? 'Take this off Pro and free the slot' : 'Put this listing on Pro'}
        className={clsx('btn btn-sm', covered ? 'btn-ghost text-ink-3 hover:text-ink' : 'btn-secondary')}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : covered ? <Minus size={14} /> : <Check size={14} />}
        {covered ? 'On Pro' : 'Add to Pro'}
      </button>
      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-line bg-surface p-2 text-[12px] leading-snug text-danger shadow-lg"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
