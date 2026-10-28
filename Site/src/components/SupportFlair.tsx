// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { CSSProperties } from 'react';
import { Bug, Lightbulb, ShieldCheck } from 'lucide-react';
import { BADGES } from '@/lib/badges';
import { BadgeMark } from './Badge';
import { FeedbackButton } from './BugReport';
import { Tooltip } from './Tooltip';

const SUPPORT = BADGES.SUPPORT;

/**
 * Decoration for a card whose listing holds the support badge: an orange wash and a beam that sweeps across.
 * Goes inside a `.support-card` (which clips it), behind the card's own content.
 */
export function SupportFlair({ seed = '' }: { seed?: string }) {
  return (
    <>
      <span aria-hidden className="support-wash" />
      {/* Offsetting by the seed keeps a grid of support cards from sweeping in lockstep. */}
      <span aria-hidden className="support-beam" style={{ '--beam-delay': `${(seed.length % 5) * 0.4}s` } as CSSProperties} />
    </>
  );
}

/**
 * The support listing's own panel. Only the support server gets it, and it carries what the server is for:
 * a bug report and a suggestion that go straight to the team (src/components/BugReport.tsx). Abuse reports
 * are off here instead - see SupportNoReport.
 */
export function SupportBanner({ seed = '', className }: { seed?: string; className?: string }) {
  return (
    <div
      className={`support-card relative overflow-hidden rounded-xl border px-4 py-3.5 ${className ?? ''}`}
      style={{ background: `color-mix(in srgb, ${SUPPORT.glow} 10%, var(--surface))` }}
    >
      <SupportFlair seed={seed} />
      <div className="relative flex items-start gap-3">
        <BadgeMark kind="SUPPORT" size={26} seed={seed} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">Need a hand with YapBoard?</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            This is the team’s own server. Ask here, or send something straight to us from this page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <FeedbackButton kind="bug" className="btn btn-secondary btn-sm">
              <Bug size={14} />
              Report a bug
            </FeedbackButton>
            <FeedbackButton kind="idea" className="btn btn-secondary btn-sm">
              <Lightbulb size={14} />
              Suggest something
            </FeedbackButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stands in for the report link on a support listing: staff's own server can't be reported for abuse. */
export function SupportNoReport() {
  return (
    <Tooltip content={`${SUPPORT.long}. Reports are off here - send a bug report or a suggestion from this page instead.`}>
      <span className="inline-flex items-center gap-1.5 text-ink-3">
        <ShieldCheck size={13} style={{ color: SUPPORT.glow }} />
        Can’t be reported
      </span>
    </Tooltip>
  );
}
