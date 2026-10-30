// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import clsx from 'clsx';
import { BETA_NOTICE, BETA_VERSION, IS_BETA } from '@/lib/beta';

/**
 * The "beta v1.10" pill beside the wordmark.
 *
 * Quiet on purpose - muted, lowercase, the same type size as the suffix the portal already puts there -
 * because it is a fact about the build rather than something to shout. The version is in it so a bug
 * report can say which beta it came from without anybody having to ask.
 *
 * Renders nothing at all in production, so it is safe to leave in the navbar unconditionally.
 */
export function BetaTag({ className }: { className?: string }) {
  if (!IS_BETA) return null;
  return (
    <span
      title={BETA_NOTICE}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5',
        'text-[11px] font-semibold leading-none text-ink-3',
        className,
      )}
    >
      beta
      <span className="font-mono text-[10.5px] opacity-80">{BETA_VERSION}</span>
    </span>
  );
}

/**
 * The strip across the top of every page saying what this is.
 *
 * Not dismissible, and that is deliberate. The board is a copy of real servers, so an owner who lands on
 * their own listing and finds a review of it needs to know - every time, not once - that it does not exist
 * on the real board. A notice somebody can turn off is a notice that stops doing its job on the second
 * visit, which is exactly when it matters.
 */
export function BetaBar() {
  if (!IS_BETA) return null;
  return (
    <div className="relative z-50 border-b border-[#e0a019]/25 bg-[#e0a019]/10">
      <p className="mx-auto max-w-7xl px-4 py-1.5 text-center text-[12px] leading-snug text-[#f2bb3c] sm:px-6">
        <span className="font-bold uppercase tracking-wider">Beta {BETA_VERSION}</span>
        <span className="mx-2 opacity-40">·</span>
        <span className="text-ink-2">{BETA_NOTICE}</span>
      </p>
    </div>
  );
}
