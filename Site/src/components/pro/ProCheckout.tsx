'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Check, CreditCard, Loader2, Minus, Plus } from 'lucide-react';
import clsx from 'clsx';
import { amount, annualSavingPct, money, planTotal, PRICING, type Cycle } from '@/lib/pro-fields';
import { WAIVER_TEXT } from '@/lib/region';
import type { PlanState } from '@/lib/pro';

/**
 * The buy box on /pro, and the slot manager it becomes once somebody is paying.
 *
 * One component for both because they answer the same question - how many listings do you want covered,
 * and how much is that - and because the second state is what the first one turns into without the page
 * changing shape under them.
 *
 * Nothing here is trusted. The cycle and the slot count are sent as a request and worked out again by
 * /api/billing/checkout against Stripe's own Prices; this component can only ask.
 */
export function ProCheckout({
  plan,
  loggedIn,
  onSale,
  needsWaiver,
}: {
  plan: PlanState;
  loggedIn: boolean;
  onSale: boolean;
  /**
   * The buyer looks to be in the UK or the EEA (or we can't tell), so the 14-day cancellation right
   * has to be asked about before they're charged. Worked out from the request on the server, and
   * checked again by /api/billing/checkout - this only decides whether to draw the box.
   */
  needsWaiver: boolean;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [slots, setSlots] = useState(0);
  const [busy, setBusy] = useState<'checkout' | 'slots' | 'portal' | null>(null);
  const [waived, setWaived] = useState(false);
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();

  /** Once they're paying, the stepper edits the plan they have rather than one they're configuring. */
  const live = plan.active;
  const shown = live ? plan.extraSlots : slots;
  const planCycle: Cycle = plan.cycle === 'annual' ? 'annual' : 'monthly';
  const effective: Cycle = live ? planCycle : cycle;

  async function checkout() {
    setError('');
    setBusy('checkout');
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cycle, extraSlots: slots, waiveWithdrawal: waived }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !out.url) {
      setBusy(null);
      setError(out.error || 'Couldn’t open checkout. Try again in a moment.');
      return;
    }
    window.location.href = out.url;
  }

  async function setQuantity(next: number) {
    setError('');
    setBusy('slots');
    const res = await fetch('/api/billing/slots', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ extraSlots: next }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setError(out.error || 'Couldn’t change your plan. Try again in a moment.');
      return;
    }
    startTransition(() => router.refresh());
  }

  async function portal() {
    setError('');
    setBusy('portal');
    const res = await fetch('/api/billing/portal', { method: 'POST' }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !out.url) {
      setBusy(null);
      setError(out.error || 'Couldn’t open the billing portal.');
      return;
    }
    window.location.href = out.url;
  }

  const step = (by: number) => {
    const next = Math.max(0, shown + by);
    if (live) void setQuantity(next);
    else setSlots(next);
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card overflow-hidden">
        {/* ---- cycle ---- */}
        {!live && (
          <div className="flex gap-1 border-b border-line bg-raised p-1.5">
            {(['monthly', 'annual'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                aria-pressed={cycle === c}
                className={clsx('relative flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors', cycle === c ? 'text-on-accent' : 'text-ink-3 hover:text-ink-2')}
              >
                {cycle === c && <motion.span layoutId="cycle-pill" className="absolute inset-0 rounded-lg bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
                <span className="relative">
                  {c === 'monthly' ? 'Monthly' : 'Annual'}
                  {c === 'annual' && <span className={clsx('ml-1.5 text-[11px] font-bold', cycle === c ? 'opacity-80' : 'text-accent')}>Save {annualSavingPct()}%</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* ---- price ---- */}
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[44px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
              {amount(planTotal(effective, shown))}
            </span>
            <span className="text-sm text-ink-3">/{effective === 'annual' ? 'year' : 'month'}</span>
            <span className="ml-auto text-xs text-ink-3">{PRICING.currency}</span>
          </div>

          <ul className="mt-5 space-y-2.5 text-sm">
            <Line>
              One server, one bot and one client on Pro - <b>{money(PRICING.base[effective], effective)}</b>
            </Line>
            <Line>
              Each extra listing, any kind - <b>{money(PRICING.slot[effective], effective)}</b>
            </Line>
            {!live && <Line>Cancel in a click - Pro runs to the end of the period you&rsquo;ve paid for</Line>}
          </ul>

          {/* ---- slots ---- */}
          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-line bg-raised px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Extra listings</div>
              <div className="mt-0.5 text-[12.5px] text-ink-3">
                {shown === 0 ? 'Just the three included' : `${3 + shown} listings covered in total`}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Stepper label="One fewer extra listing" onClick={() => step(-1)} disabled={shown === 0 || !!busy}>
                <Minus size={15} />
              </Stepper>
              <span className="w-7 text-center font-display text-lg font-bold tabular-nums">
                {busy === 'slots' ? <Loader2 size={15} className="mx-auto animate-spin text-ink-3" /> : shown}
              </span>
              <Stepper label="One more extra listing" onClick={() => step(1)} disabled={!!busy}>
                <Plus size={15} />
              </Stepper>
            </div>
          </div>

          {/* ---- state / action ---- */}
          {live ? (
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <b>You&rsquo;re on Pro.</b>{' '}
                  {plan.covered.length === 0
                    ? 'Nothing is pointed at it yet - open a listing and put it on Pro from the manage page.'
                    : `${plan.covered.length} of ${plan.capacity} ${plan.capacity === 1 ? 'slot' : 'slots'} in use${plan.spare > 0 ? `, ${plan.spare} spare` : ''}.`}
                  {plan.endingAt && <> Ends {new Date(plan.endingAt).toLocaleDateString()}.</>}
                </div>
              </div>

              {plan.overflow.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {plan.overflow.length} {plan.overflow.length === 1 ? 'listing is' : 'listings are'} over your capacity, so their Pro fields are switched off. Nothing has been
                    deleted - add a slot and they come straight back.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard" className="btn btn-primary btn-sm group">
                  Your listings
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <button type="button" onClick={portal} disabled={!!busy} className="btn btn-secondary btn-sm">
                  {busy === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Manage billing
                </button>
              </div>
            </div>
          ) : !onSale ? (
            <div className="mt-6">
              <span className="btn btn-primary btn-lg w-full cursor-default">Coming soon</span>
              <p className="mt-3 text-center text-xs leading-relaxed text-ink-3">Pro isn&rsquo;t on sale yet. List your server for free in the meantime.</p>
            </div>
          ) : !loggedIn ? (
            <Link href="/login?next=/pro" className="btn btn-primary btn-lg mt-6 w-full group">
              Log in to upgrade
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            <>
              {needsWaiver && (
                <label className="mt-6 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-raised p-4 text-[12.5px] leading-relaxed text-ink-2 transition-colors hover:border-line-strong">
                  <input
                    type="checkbox"
                    checked={waived}
                    onChange={(e) => setWaived(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                    aria-describedby="waiver-text"
                  />
                  <span id="waiver-text">{WAIVER_TEXT}</span>
                </label>
              )}
              <button
                type="button"
                onClick={checkout}
                disabled={!!busy || (needsWaiver && !waived)}
                className="btn btn-primary btn-lg mt-4 w-full group"
              >
                {busy === 'checkout' ? <Loader2 size={17} className="animate-spin" /> : null}
                Upgrade to Pro
                {busy !== 'checkout' && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
              </button>
            </>
          )}

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 text-center text-sm text-danger">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!live && onSale && (
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-3">
          Card details are handled by Stripe. YapBoard never sees them. By subscribing you agree to the{' '}
          <Link href="/terms#pro" className="underline underline-offset-2 hover:text-ink-2">
            subscription terms
          </Link>
          , including automatic renewal until you cancel.
        </p>
      )}
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-ink-2">
      <Check size={15} className="mt-[3px] shrink-0 text-accent" />
      <span>{children}</span>
    </li>
  );
}

function Stepper({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}
