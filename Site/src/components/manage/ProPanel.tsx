'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowUpRight, Check, CreditCard, Loader2, Minus, Plus } from 'lucide-react';
import { BadgeMark } from '../Badge';
import type { PlanState } from '@/lib/pro';
import { money, PRICING, type Cycle, type ListingKind } from '@/lib/pro-fields';

/**
 * Whether this one listing is on the owner's Pro plan, and the two buttons that change that.
 *
 * It sits on the manage page rather than in a billing screen of its own because that's where the
 * question comes up: an owner looking at a locked screenshot gallery wants to point a slot at *this*
 * listing, not to go and read about plans. The plan-wide view lives on /pro.
 *
 * Assigning and buying are kept apart on purpose, the same way the API keeps them apart. Pointing a slot
 * you already own at a listing is free, instant and reversible; buying one bills you. Rolling them into a
 * single button would make a misclick cost money.
 */

const NOUN: Record<ListingKind, string> = { server: 'server', bot: 'bot', client: 'client' };

export function ProPanel({
  kind,
  listingId,
  plan,
  billingOn,
  removed,
}: {
  kind: ListingKind;
  listingId: string;
  plan: PlanState;
  billingOn: boolean;
  /** Staff removed the listing. It can never come back, so it must never be something anybody pays for. */
  removed: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'assign' | 'remove' | 'buy' | 'portal' | null>(null);
  const [, startTransition] = useTransition();

  const covered = plan.covered.find((c) => c.kind === kind && c.listingId === listingId);
  const overflowed = plan.overflow.some((o) => o.kind === kind && o.listingId === listingId);

  /** Quoted at the cycle they're actually on, so an annual plan isn't told a monthly figure. */
  const cycle: Cycle = plan.cycle === 'annual' ? 'annual' : 'monthly';
  const slotPrice = money(PRICING.slot[cycle], cycle);

  async function call(what: 'assign' | 'remove' | 'buy' | 'portal') {
    setError('');
    setBusy(what);
    const req =
      what === 'portal'
        ? ['/api/billing/portal', 'POST', {}]
        : what === 'buy'
          ? ['/api/billing/slots', 'PATCH', { extraSlots: plan.extraSlots + 1 }]
          : ['/api/billing/slots', what === 'assign' ? 'POST' : 'DELETE', { kind, listingId }];
    const [url, method, body] = req as [string, string, object];

    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setBusy(null);
      setError(out.error || 'Something went wrong. Try again in a moment.');
      return;
    }
    if (what === 'portal' && out.url) {
      window.location.href = out.url;
      return;
    }
    setBusy(null);
    // The form's caps are worked out on the server, so the page has to be re-rendered for the new
    // limits - and the newly unlocked fields - to appear.
    startTransition(() => router.refresh());
  }

  if (!billingOn) return null;

  return (
    <section className="card mt-10 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <BadgeMark kind="PRO" size={18} seed={listingId} />
          YapBoard Pro
        </h2>
        {plan.active && (
          <button type="button" onClick={() => call('portal')} disabled={!!busy} className="btn btn-secondary btn-sm">
            {busy === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Manage billing
          </button>
        )}
      </div>

      <div className="px-6 py-5">
        {plan.grace && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Your last payment didn&rsquo;t go through. Everything still works for now - update your card from{' '}
              <b>Manage billing</b> and nothing changes.
            </span>
          </div>
        )}

        {removed ? (
          <Body title="Not available" body="YapBoard staff removed this listing, so it can’t be put on Pro." />
        ) : !plan.active ? (
          <Body title={`This ${NOUN[kind]} is on a free listing`} body="Pro adds a header style, a screenshot gallery, extra buttons, twice the tags and a much longer description.">
            <Link href="/pro" className="btn btn-primary btn-sm group">
              See what Pro adds
              <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </Body>
        ) : covered ? (
          <Body
            title="On Pro"
            body={
              covered.via === 'base'
                ? `Covered by your plan’s ${NOUN[kind]} slot. Every Pro field on this page is unlocked.`
                : 'Covered by one of your extra listing slots. Every Pro field on this page is unlocked.'
            }
            tone="good"
          >
            <button type="button" onClick={() => call('remove')} disabled={!!busy} className="btn btn-secondary btn-sm">
              {busy === 'remove' ? <Loader2 size={14} className="animate-spin" /> : <Minus size={14} />}
              Take off Pro
            </button>
            <p className="mt-2 w-full text-[12.5px] text-ink-3">
              The slot goes back to your plan for another listing. Your bill doesn&rsquo;t change until you drop the slot itself.
            </p>
          </Body>
        ) : overflowed ? (
          <Body
            title="Waiting for a slot"
            body={`This ${NOUN[kind]} is on your plan but over its capacity, so its Pro fields are switched off. Nothing has been deleted - add a slot and it comes straight back.`}
            tone="warn"
          >
            <BuyButton busy={busy} onClick={() => call('buy')} />
          </Body>
        ) : plan.spare > 0 ? (
          <Body title="You have a free slot" body={`Your plan has ${plan.spare} ${plan.spare === 1 ? 'slot' : 'slots'} spare. Put this ${NOUN[kind]} in one and its Pro fields unlock straight away.`}>
            <button type="button" onClick={() => call('assign')} disabled={!!busy} className="btn btn-primary btn-sm">
              {busy === 'assign' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Put this {NOUN[kind]} on Pro
            </button>
          </Body>
        ) : (
          <Body
            title="Your plan is full"
            body={`Every slot is pointed at another listing. An extra listing slot covers this ${NOUN[kind]} for ${slotPrice} more, charged pro rata for the rest of this period.`}
          >
            <BuyButton busy={busy} onClick={() => call('buy')} />
          </Body>
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

function BuyButton({ busy, onClick }: { busy: string | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!!busy} className="btn btn-primary btn-sm">
      {busy === 'buy' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
      Add a slot - $1/mo
    </button>
  );
}

function Body({ title, body, tone, children }: { title: string; body: string; tone?: 'good' | 'warn'; children?: React.ReactNode }) {
  return (
    <div>
      <h3 className={`text-sm font-semibold ${tone === 'good' ? 'text-accent' : tone === 'warn' ? 'text-warn' : ''}`}>{title}</h3>
      <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-3">{body}</p>
      {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
