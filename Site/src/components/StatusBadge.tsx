// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import clsx from 'clsx';

const STYLES: Record<string, [string, string]> = {
  PUBLIC: ['Public', 'text-ok bg-ok/10 border-ok/30'],
  UNLISTED: ['Unlisted', 'text-ink-2 bg-surface-2 border-line-strong'],
  HIDDEN: ['Hidden by staff', 'text-warn bg-warn/10 border-warn/30'],
  REMOVED: ['Removed', 'text-danger bg-danger/10 border-danger/30'],
  OPEN: ['Open', 'text-accent bg-accent-soft border-accent/30'],
  ACTIONED: ['Actioned', 'text-ok bg-ok/10 border-ok/30'],
  DISMISSED: ['Dismissed', 'text-ink-3 bg-surface-2 border-line-strong'],
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const [label, style] = STYLES[status] ?? [status, 'text-ink-2 bg-surface-2 border-line-strong'];
  return <span className={clsx('inline-flex items-center h-5 px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap', style, className)}>{label}</span>;
}
