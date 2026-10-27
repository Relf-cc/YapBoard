'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Loader2, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../Modal';
import { LEGAL } from '@/lib/legal';

/**
 * The last step before a client listing is submitted.
 *
 * Both boxes have to be ticked, separately, because they are two different promises to two different people:
 * YapBoard's client terms are ours, and Yapin's terms are Yapin's. Nobody can list software for other people
 * to run on the strength of a line of grey text under a button, so this asks plainly, names what's being
 * agreed to, and links both documents in full.
 *
 * The API requires the flag this sets (`agreeTerms`), and the moment it's accepted is stored on the listing,
 * so "they agreed" is a fact on the row rather than something the form remembers.
 */
export function ClientTermsDialog({ clientName, busy, onClose, onAgree }: { clientName: string; busy: boolean; onClose: () => void; onAgree: () => void }) {
  const [board, setBoard] = useState(false);
  const [yapin, setYapin] = useState(false);
  const ready = board && yapin && !busy;

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <ShieldCheck size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="pr-6 text-lg font-bold leading-snug">Before you list {clientName}</h2>
          <p className="mt-1 text-sm text-ink-3">Two things to agree to, then it goes to staff.</p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <Agreement checked={board} onChange={setBoard} href="/clients/terms" title="YapBoard client terms">
          The client is mine to list, it does what the listing says, the downloads are the real files, and it contains
          no malware, no credential or token theft, and no hidden data collection.
        </Agreement>
        <Agreement checked={yapin} onChange={setYapin} href={LEGAL.yapinTerms} external title="Yapin’ terms of service">
          My client follows Yapin’s terms and API rules — no automation of user accounts, no scraping, no evading
          limits or moderation — and I accept that Yapin’, not YapBoard, decides what’s allowed on Yapin’.
        </Agreement>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
        Staff review every client listing before it goes up, and can take one down at any time. Listing software that
        harms people gets the listing removed and the account banned.
      </p>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="btn btn-ghost flex-1" disabled={busy}>
          Back
        </button>
        <button type="button" onClick={onAgree} disabled={!ready} className={clsx('btn btn-primary flex-1', !ready && 'opacity-50')}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? 'Submitting…' : 'Agree and submit'}
        </button>
      </div>
    </Modal>
  );
}

function Agreement({
  checked,
  onChange,
  href,
  external,
  title,
  children,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  href: string;
  external?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx('rounded-xl border p-3.5 transition-colors', checked ? 'border-accent/45 bg-accent-soft' : 'border-line')}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">I agree to the {title}</span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-3">{children}</span>
        </span>
      </label>
      {external ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 ml-7 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          Read them <ExternalLink size={11} />
        </a>
      ) : (
        <Link href={href} target="_blank" className="mt-2 ml-7 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          <FileText size={11} /> Read them
        </Link>
      )}
    </div>
  );
}
