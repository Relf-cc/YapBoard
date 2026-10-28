'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Download, ExternalLink, ShieldAlert, Tag } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../Modal';
import { PlatformIcon } from './PlatformIcon';
import { archLabel, fileSize, PLATFORMS, type Platform } from '@/lib/platforms';

export type DownloadFile = { id: number; platform: string; kind: string; arch: string; label: string; url: string; size: number | null; managed: boolean };
export type DownloadGroup = { platform: Platform; files: DownloadFile[] };

type Props = {
  clientId: string;
  clientName: string;
  accent: string;
  version: string | null;
  releaseUrl: string | null;
  groups: DownloadGroup[];
  /** Platforms the lister says it runs on, so one with no file yet can say "coming" instead of vanishing. */
  claimed: Platform[];
};

/**
 * The download section, and the Trust & Safety dialog in front of it.
 *
 * Every button here sends somebody to a file on a stranger's release page, which they will then run on their
 * own machine with their Yapin' account in it. YapBoard doesn't build, host or scan any of it, and saying so
 * once in the footer is not the same as saying it at the moment somebody clicks. So the click opens the
 * dialog, the dialog names the file and where it's going, and only then does the download start.
 *
 * It's shown once per client per browsing session: enough to be a real decision, not so often that somebody
 * grabbing the Windows and Linux builds learns to dismiss it without reading. Closing the tab resets it.
 */
export function DownloadPanel({ clientId, clientName, accent, version, releaseUrl, groups, claimed }: Props) {
  const [asked, setAsked] = useState<DownloadFile | null>(null);
  const [trusted, setTrusted] = useState(false);

  const storageKey = `yb_trust_${clientId}`;
  useEffect(() => {
    try {
      setTrusted(sessionStorage.getItem(storageKey) === '1');
    } catch {
      // Private mode and blocked storage both land here: the dialog simply shows every time.
    }
  }, [storageKey]);

  const href = (f: DownloadFile) => `/get/${clientId}/${f.id}`;

  function start(f: DownloadFile) {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* nothing to remember it in; the dialog comes back next time */
    }
    setTrusted(true);
    setAsked(null);
    window.location.href = href(f);
  }

  function click(e: React.MouseEvent, f: DownloadFile) {
    // Already agreed this session: the link does its own job, including middle-click and "save link as".
    if (trusted) return;
    e.preventDefault();
    setAsked(f);
  }

  /** Platforms the lister claims but has no file for. Worth saying out loud rather than quietly omitting. */
  const missing = useMemo(() => claimed.filter((p) => !groups.some((g) => g.platform === p)), [claimed, groups]);

  return (
    <section id="download" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Download</h2>
        <div className="flex items-center gap-3 text-xs text-ink-3">
          {version && (
            <span className="inline-flex items-center gap-1.5">
              <Tag size={13} />
              <code className="font-mono text-ink-2">{version}</code>
            </span>
          )}
          {releaseUrl && (
            <a href={releaseUrl} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-ink">
              Release page <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card mt-4 px-5 py-8 text-center text-sm text-ink-3">
          No downloads are listed yet. {releaseUrl ? 'Check the release page.' : 'Ask the maintainer where to get it.'}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {groups.map((g) => (
            <div key={g.platform} className="card overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
                <span className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}>
                  <PlatformIcon platform={g.platform} size={15} />
                </span>
                <h3 className="text-sm font-bold">{PLATFORMS[g.platform].label}</h3>
                <span className="text-xs text-ink-3">{PLATFORMS[g.platform].hint}</span>
              </div>
              <ul className="divide-y divide-line">
                {g.files.map((f) => (
                  <li key={f.id}>
                    <a
                      href={href(f)}
                      onClick={(e) => click(e, f)}
                      rel="nofollow noopener"
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{f.label}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {[f.kind && `.${f.kind}`, archLabel(f.arch), fileSize(f.size)].filter(Boolean).join(' · ') || 'External link'}
                        </span>
                      </span>
                      <span
                        className="btn btn-sm shrink-0 transition-colors"
                        style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, border: `1px solid color-mix(in srgb, ${accent} 34%, transparent)` }}
                      >
                        <Download size={14} />
                        Get
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <p className="mt-3 text-xs text-ink-3">
          The maintainer lists {missing.map((p) => PLATFORMS[p].label).join(', ')} too, but there’s no file for {missing.length === 1 ? 'it' : 'those'} in the latest release.
        </p>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
        <ShieldAlert size={14} className="mt-px shrink-0 text-warn" />
        <span>
          YapBoard doesn’t build, host or scan these files - every download goes straight to the maintainer.{' '}
          <Link href="/clients/terms#safety" className="underline decoration-line hover:text-ink">
            What to check before you run one
          </Link>
          .
        </span>
      </p>

      <AnimatePresence>{asked && <TrustDialog file={asked} clientName={clientName} onClose={() => setAsked(null)} onConfirm={() => start(asked)} />}</AnimatePresence>
    </section>
  );
}

/** Where a file is really coming from, e.g. "github.com". The one fact most worth putting in front of someone. */
function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'an external site';
  }
}

function TrustDialog({ file, clientName, onClose, onConfirm }: { file: DownloadFile; clientName: string; onClose: () => void; onConfirm: () => void }) {
  const [understood, setUnderstood] = useState(false);
  return (
    <Modal onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-warn/12 text-warn">
          <ShieldAlert size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="pr-6 text-lg font-bold leading-snug">Before you download</h2>
          <p className="mt-0.5 text-sm text-ink-3">This file isn’t from YapBoard.</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-raised p-3">
        <p className="truncate font-mono text-[13px] text-ink">{file.label}</p>
        <p className="mt-1 text-xs text-ink-3">
          From <b className="text-ink-2">{hostOf(file.url)}</b>
          {file.size ? ` · ${fileSize(file.size)}` : ''}
        </p>
      </div>

      <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink-2">
        <Point>
          <b className="text-ink">{clientName}</b> is made by someone else. We don’t build, host or scan it.
        </Point>
        <Point>It runs with your Yapin’ account signed in - a dishonest client can read your messages and take your token.</Point>
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:border-line-strong">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-[13px] leading-relaxed text-ink-2">I understand, and I’m downloading it at my own risk.</span>
      </label>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={!understood} className={clsx('btn btn-primary flex-1', !understood && 'opacity-50')}>
          <Download size={15} />
          Download
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-3">
        <Link href="/clients/terms" className="underline decoration-line hover:text-ink">
          Client terms
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="underline decoration-line hover:text-ink">
          YapBoard terms
        </Link>
      </p>
    </Modal>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-warn" />
      <span>{children}</span>
    </li>
  );
}
