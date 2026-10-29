'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Loader2, MousePointerClick, RefreshCw, Sparkles } from 'lucide-react';
import { Modal } from '../Modal';
import { BadgeMark } from '../Badge';

/**
 * The thank-you on the way back from Stripe Checkout.
 *
 * `success_url` is /dashboard?pro=welcome (src/app/api/billing/checkout/route.ts), and this is what that
 * query string is for. It is deliberately the only thing that triggers it: a plan going live is not by
 * itself news - somebody could have bought it on another device, or be coming back a week later - so this
 * says "that worked" to the person who just paid, and nothing to anyone else.
 *
 * ## Why it can open before the plan exists
 *
 * Nothing about Pro is true until the webhook has been delivered and written the row, and the redirect is
 * a race with it. `checkout.session.completed` usually lands first, which is why the success page can
 * normally say "you're on Pro" outright - but usually is not always, and a modal that cheerfully claimed
 * Pro while `planState` said otherwise would be the one screen a new customer least wants to doubt. So
 * `active` is passed in from the server and the copy follows it: confirmed when the row is there, and
 * honest about waiting when it isn't, with a refresh rather than a promise.
 *
 * Closing it drops the query string, so a refresh - or coming back through history - doesn't show it twice.
 */
export function ProWelcome({ active, spare, hasListings }: { active: boolean; spare: number; hasListings: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [checking, setChecking] = useState(false);

  function close() {
    setOpen(false);
    // `scroll: false` so dropping the param doesn't jump them to the top of their own listings.
    router.replace('/dashboard', { scroll: false });
  }

  function recheck() {
    setChecking(true);
    router.refresh();
    // No callback to wait on: the refresh re-renders the page with whatever the webhook has written by
    // now. A second of spinner, then whichever half of this dialog is true.
    setTimeout(() => setChecking(false), 1200);
  }

  return (
    <AnimatePresence>
      {open && (
        <Modal onClose={close}>
          <div className="text-center">
            <motion.span
              initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.05 }}
              className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-accent-soft"
            >
              {active ? <BadgeMark kind="PRO" size={30} seed="welcome" /> : <Sparkles size={26} className="text-accent" />}
            </motion.span>

            <h2 className="mt-4 text-xl font-bold leading-snug text-ink">{active ? 'You’re on YapBoard Pro' : 'Payment received'}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-3">
              {active
                ? 'Thanks - genuinely. Here’s the one thing left to do.'
                : 'Stripe has it. We’re waiting on their confirmation to switch your plan on, which usually takes a second or two.'}
            </p>
          </div>

          {active ? (
            <>
              <div className="mt-5 rounded-xl border border-line bg-raised p-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-accent">
                    <MousePointerClick size={20} />
                  </span>
                  <div className="min-w-0 text-[13.5px] leading-relaxed text-ink-2">
                    {spare === 0 ? (
                      <>
                        <b className="text-ink">Every slot is already pointed at a listing.</b> Nothing left to do - the Pro fields are unlocked on each of them, and you can move a
                        slot to a different listing whenever you like.
                      </>
                    ) : (
                      <>
                        <b className="text-ink">Point your plan at a listing.</b> Pro is held by a listing, not by your account, so open the one you want and press{' '}
                        <b className="text-ink">Put this on Pro</b> on its manage page. You have {spare === 1 ? 'one slot' : `${spare} slots`} to place
                        {spare > 1 ? ' - one server, one bot and one client, plus any extras you bought' : ''}.
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <Link href="/pro#price" className="btn btn-ghost btn-sm">
                  Manage plan
                </Link>
                <button type="button" onClick={close} className="btn btn-primary btn-sm group">
                  {hasListings ? 'Choose a listing' : 'Add a listing'}
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-center text-[13px] leading-relaxed text-ink-3">
                Nothing is lost if you close this - your plan switches on by itself. If it still isn’t on in a few minutes, the receipt in your email is proof of purchase and we’ll sort it out.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={recheck} disabled={checking} className="btn btn-secondary btn-sm">
                  {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Check again
                </button>
                <button type="button" onClick={close} className="btn btn-ghost btn-sm">
                  Close
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </AnimatePresence>
  );
}
