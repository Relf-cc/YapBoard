'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Images, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { sortBadges } from '@/lib/badges';
import { MAX_MANUAL_FILES, MAX_SCREENSHOTS, RELEASE_SOURCES, THEMES } from '@/lib/client-fields';
import { LANGUAGES } from '@/lib/languages';
import { PLATFORMS, PLATFORM_ORDER, type Platform } from '@/lib/platforms';
import { Dropdown } from '../Dropdown';
import { ClientCard } from '../ClientCard';
import { PlatformIcon } from '../clients/PlatformIcon';
import { TagInput } from './TagInput';
import { ACCENTS } from './ListingForm';
import { ClientTermsDialog } from '../clients/ClientTermsDialog';

const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }));
const PLATFORM_OPTIONS = PLATFORM_ORDER.map((value) => ({ value, label: PLATFORMS[value].label }));

export type ClientFileValue = { platform: string; label: string; url: string; kind: string };

export type ClientListingValues = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  iconUrl: string;
  bannerUrl: string;
  website: string;
  sourceUrl: string;
  framework: string;
  supportServerId: string;
  language: string;
  nsfw: boolean;
  unlisted: boolean;
  accent: string;
  theme: string;
  screenshots: string[];
  platforms: string[];
  releaseSource: string;
  repo: string;
  /** The links the lister keeps themselves. Files synced from a release are never edited here. */
  files: ClientFileValue[];
  tags: string[];
  /** Read-only, for the preview and the sync panel. */
  badges?: string[];
  version?: string | null;
  downloads?: number;
  managedCount?: number;
  releaseError?: string | null;
};

type Errors = Partial<Record<keyof ClientListingValues | 'agreeTerms', string[]>>;

/**
 * The listing form for a client, on both /clients/add and the manage page.
 *
 * Two things set it apart from the server and bot forms. Creating a listing goes through the terms dialog
 * first — a client is software other people will run, so accepting the client terms and Yapin's terms is part
 * of submitting, not a line of small print under the button. And the downloads section is a real editor:
 * listers either point at a GitHub repo and let releases fill it in, or keep the links themselves.
 */
export function ClientListingForm({ mode, initial }: { mode: 'create' | 'edit'; initial: ClientListingValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [terms, setTerms] = useState(false);
  const [syncing, setSyncing] = useState<'idle' | 'busy' | 'done'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const set = <K extends keyof ClientListingValues>(k: K, val: ClientListingValues[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(initial), [v, initial]);
  const onGithub = v.releaseSource === 'GITHUB';

  async function save(agreed: boolean) {
    setState('saving');
    setFormError('');
    const body = { ...v, ...(mode === 'create' ? { agreeTerms: agreed } : {}) };
    const res = await fetch(mode === 'create' ? '/api/clients' : `/api/clients/${initial.id}`, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setErrors(out.fields ?? {});
      setFormError(out.fields ? 'A few things need fixing.' : out.error || 'Something went wrong.');
      setState('idle');
      return;
    }
    if (mode === 'create') {
      // Queued, not live: the manage page explains where it stands.
      router.push(`/clients/${out.slug}/manage?created=1`);
      return;
    }
    setState('saved');
    router.refresh();
    setTimeout(() => setState('idle'), 1800);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Creating goes through the terms dialog; editing doesn't ask again.
    if (mode === 'create') return setTerms(true);
    void save(false);
  }

  async function sync() {
    setSyncing('busy');
    setSyncMessage('');
    const res = await fetch(`/api/clients/${initial.id}/sync`, { method: 'POST' }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setSyncing('idle');
      setSyncMessage(out.error || 'Couldn’t reach GitHub. Try again in a minute.');
      return;
    }
    setSyncing('done');
    setSyncMessage(`${out.version ?? 'Latest release'} · ${out.files} file${out.files === 1 ? '' : 's'}`);
    router.refresh();
    setTimeout(() => setSyncing('idle'), 2500);
  }

  const preview = {
    id: v.id || 'preview',
    slug: v.slug || 'preview',
    name: v.name || 'Your client',
    iconUrl: v.iconUrl || null,
    summary: v.summary || 'Your one-liner shows up here. Make it count.',
    version: v.version ?? null,
    downloads: v.downloads ?? 0,
    bumpedAt: new Date().toISOString(),
    language: v.language,
    nsfw: v.nsfw,
    accent: v.accent,
    platforms: (v.platforms.length ? v.platforms : ['windows']) as Platform[],
    badges: sortBadges(v.badges ?? []),
    tags: v.tags.length ? v.tags : ['your-tags'],
  };

  const togglePlatform = (p: string) => set('platforms', v.platforms.includes(p) ? v.platforms.filter((x) => x !== p) : [...v.platforms, p]);

  return (
    <>
      <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_360px]" noValidate>
        <div className="min-w-0 space-y-8">
          <Section title="The client" hint="What it is, and what it changes about Yapin’.">
            <Field label="Name" error={errors.name} count={[v.name.length, 60]} help={mode === 'edit' ? `Its address stays /clients/${initial.slug} even if you rename it.` : 'This becomes its address, e.g. /clients/your-client.'}>
              <input className="field" value={v.name} maxLength={60} onChange={(e) => set('name', e.target.value)} placeholder="Yapin’ Plus" required />
            </Field>
            <Field label="One-liner" error={errors.summary} count={[v.summary.length, 140]}>
              <input className="field" value={v.summary} maxLength={140} onChange={(e) => set('summary', e.target.value)} placeholder="Themes, plugins and a compact message layout." />
            </Field>
            <Field
              label="Description"
              error={errors.description}
              count={[v.description.length, 4000]}
              help="Blank lines make paragraphs. Start lines with - for a list. **bold** and https links work. Say what you changed and what you didn’t."
            >
              <textarea
                className="field"
                rows={10}
                maxLength={4000}
                value={v.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder={'What does your client add or change?\n\n- Custom themes and CSS\n- A plugin loader\n- Compact mode and a smaller sidebar\n\nWhat it doesn’t do: no automation, no self-botting, no message scraping.'}
              />
            </Field>
          </Section>

          <Section title="Downloads" hint="Where people get it. This is the part staff look at hardest, so keep it honest.">
            <Field label="Where releases come from" error={errors.releaseSource}>
              <Dropdown
                label="Where releases come from"
                value={v.releaseSource}
                onChange={(s) => set('releaseSource', s)}
                options={Object.entries(RELEASE_SOURCES).map(([value, label]) => ({ value, label }))}
              />
            </Field>

            {onGithub ? (
              <Field
                label="GitHub repository"
                error={errors.repo}
                help="Paste the repo URL or owner/repo. We read releases/latest and sort its files by platform — .exe to Windows, .deb to Linux, and so on."
              >
                <div className="flex gap-2">
                  <input
                    className="field font-mono text-sm"
                    value={v.repo}
                    onChange={(e) => set('repo', e.target.value)}
                    placeholder="github.com/you/your-client"
                    inputMode="url"
                  />
                  {mode === 'edit' && (
                    <button type="button" className="btn btn-secondary shrink-0" disabled={syncing === 'busy'} onClick={sync}>
                      {syncing === 'busy' ? <Loader2 size={15} className="animate-spin" /> : syncing === 'done' ? <Check size={15} /> : <RefreshCw size={15} />}
                      Sync
                    </button>
                  )}
                </div>
              </Field>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-3">
                You keep the links yourself. Add one per platform below — they show up as download buttons, behind the same Trust &amp; Safety notice every client gets.
              </p>
            )}

            {mode === 'edit' && onGithub && (
              <div className="rounded-xl border border-line bg-raised px-4 py-3 text-[13px]">
                {syncMessage ? (
                  <p className={syncing === 'done' ? 'text-ok' : 'text-danger'}>{syncMessage}</p>
                ) : v.releaseError ? (
                  <p className="text-warn">Last check couldn’t read the release. Press Sync to try again.</p>
                ) : (
                  <p className="text-ink-3">
                    <b className="text-ink-2">{v.managedCount ?? 0}</b> file{(v.managedCount ?? 0) === 1 ? '' : 's'} from the latest release
                    {v.version ? <> · <code className="font-mono text-ink-2">{v.version}</code></> : ''}. Releases refresh on their own every half hour.
                  </p>
                )}
              </div>
            )}

            <FileEditor files={v.files} onChange={(f) => set('files', f)} error={errors.files} optional={onGithub} />
          </Section>

          <Section title="Platforms" hint="What it runs on. Cards show these, and the board can be filtered by them.">
            <Field error={errors.platforms}>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_ORDER.map((p) => {
                  const on = v.platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePlatform(p)}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors',
                        on ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <PlatformIcon platform={p} size={15} />
                      {PLATFORMS[p].label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          <Section title="Links">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Website" error={errors.website} help="Optional. Docs, a landing page, anything.">
                <input className="field" value={v.website} onChange={(e) => set('website', e.target.value)} placeholder="https://yourclient.example" inputMode="url" />
              </Field>
              <Field label="Source code" error={errors.sourceUrl} help="Optional, and only needed if it isn’t the GitHub repo above.">
                <input className="field" value={v.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://gitlab.com/you/your-client" inputMode="url" />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Built with" error={errors.framework} help="Optional, e.g. Electron or Tauri.">
                <input className="field" value={v.framework} maxLength={40} onChange={(e) => set('framework', e.target.value)} placeholder="Electron" />
              </Field>
              <Field label="Support server ID" error={errors.supportServerId} help="Optional. A Yapin’ server where people get help with it.">
                <input className="field font-mono text-sm" value={v.supportServerId} onChange={(e) => set('supportServerId', e.target.value.trim())} placeholder="e.g. 2b81f05c…" />
              </Field>
            </div>
          </Section>

          <Section title="How the page looks" hint="Your page, not a template. These only change the listing on YapBoard.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Icon URL" error={errors.iconUrl} help="Square, at least 128px. Leave it empty for initials.">
                <input className="field" value={v.iconUrl} onChange={(e) => set('iconUrl', e.target.value)} placeholder="https://…/icon.png" inputMode="url" />
              </Field>
              <Field label="Banner URL" error={errors.bannerUrl} help="Wide, about 1500×500. Sits behind the header.">
                <input className="field" value={v.bannerUrl} onChange={(e) => set('bannerUrl', e.target.value)} placeholder="https://…/banner.png" inputMode="url" />
              </Field>
            </div>

            <Field label="Header style" help="How the top of your page is drawn when there’s no banner — and over it when there is.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={v.theme === t}
                    onClick={() => set('theme', t)}
                    className={clsx('overflow-hidden rounded-xl border text-left transition-colors', v.theme === t ? 'border-accent/60' : 'border-line hover:border-line-strong')}
                  >
                    <ThemeSwatch theme={t} accent={v.accent} />
                    <span className="block px-3 py-2 text-[13px] font-medium">{THEMES[t]}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Accent colour">
              <div className="flex flex-wrap gap-2 pt-1.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    aria-pressed={v.accent === c}
                    onClick={() => set('accent', c)}
                    className="relative size-7 rounded-full transition-transform hover:scale-110"
                    style={{ background: c }}
                  >
                    {v.accent === c && (
                      <motion.span layoutId="client-accent-ring" className="absolute -inset-1 rounded-full border-2 border-ink" transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
                    )}
                  </button>
                ))}
              </div>
            </Field>

            <ScreenshotEditor urls={v.screenshots} onChange={(s) => set('screenshots', s)} error={errors.screenshots} />
          </Section>

          <Section title="Tags" hint="Up to five. These drive search, so pick what people would type.">
            <Field error={errors.tags}>
              <TagInput value={v.tags} onChange={(t) => set('tags', t)} invalid={!!errors.tags} />
            </Field>
          </Section>

          <Section title="Details">
            <Field label="Main language" error={errors.language}>
              <Dropdown label="Main language" value={v.language} onChange={(l) => set('language', l)} options={LANGUAGE_OPTIONS} />
            </Field>
            <div className="mt-6 grid gap-3">
              <Toggle checked={v.nsfw} onChange={(b) => set('nsfw', b)} title="18+ client" body="Hidden from the board unless people turn on 18+ results. Required if it has adult features." />
              <Toggle checked={v.unlisted} onChange={(b) => set('unlisted', b)} title="Unlisted" body="Keep the page, but leave it out of the client board. Anyone with the link can still see it." />
            </div>
          </Section>
        </div>

        {/* preview + save */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">Live preview</p>
          <div className="pointer-events-none">
            <ClientCard client={preview} />
          </div>

          <div className="card p-4">
            <AnimatePresence>
              {formError && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 text-sm text-danger">
                  {formError}
                </motion.p>
              )}
            </AnimatePresence>
            <button className="btn btn-primary btn-lg w-full" disabled={state === 'saving' || (mode === 'edit' && !dirty && state !== 'saved')}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={state} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-2">
                  {state === 'saving' && <Loader2 size={17} className="animate-spin" />}
                  {state === 'saved' && <Check size={17} />}
                  {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : mode === 'create' ? 'Submit for review' : 'Save changes'}
                </motion.span>
              </AnimatePresence>
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-ink-3">
              {mode === 'create' ? (
                <>
                  You’ll be asked to accept the{' '}
                  <Link href="/clients/terms" target="_blank" className="text-accent hover:underline">
                    client terms
                  </Link>{' '}
                  before it’s submitted.
                </>
              ) : (
                'Changing the repository or where downloads come from sends the listing back for review.'
              )}
            </p>
          </div>
        </div>
      </form>

      <AnimatePresence>
        {terms && (
          <ClientTermsDialog
            clientName={v.name || 'your client'}
            busy={state === 'saving'}
            onClose={() => setTerms(false)}
            onAgree={() => {
              setTerms(false);
              void save(true);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- downloads the lister keeps ---------------- */

function FileEditor({ files, onChange, error, optional }: { files: ClientFileValue[]; onChange: (f: ClientFileValue[]) => void; error?: string[]; optional: boolean }) {
  const edit = (i: number, patch: Partial<ClientFileValue>) => onChange(files.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">{optional ? 'Extra download links' : 'Download links'}</span>
        <span className="text-xs tabular-nums text-ink-3">
          {files.length}/{MAX_MANUAL_FILES}
        </span>
      </div>
      <p className="mb-3 text-[13px] text-ink-3">
        {optional
          ? 'Optional, on top of the release files — a portable build, a mirror, a package on another store.'
          : 'One per platform. These are the buttons people press.'}
      </p>

      <div className="space-y-2">
        {files.map((f, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[150px_1fr_auto]">
            <Dropdown label="Platform" size="md" value={f.platform} onChange={(p) => edit(i, { platform: p })} options={PLATFORM_OPTIONS} />
            <div className="grid gap-2">
              <input className="field h-10 text-sm" value={f.label} maxLength={120} onChange={(e) => edit(i, { label: e.target.value })} placeholder="YourClient 1.2.0 (installer)" />
              <input className="field h-10 font-mono text-[13px]" value={f.url} onChange={(e) => edit(i, { url: e.target.value })} placeholder="https://…/YourClient-Setup.exe" inputMode="url" />
            </div>
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="btn btn-ghost btn-sm self-start text-ink-3 hover:text-danger" aria-label="Remove this link">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {files.length < MAX_MANUAL_FILES && (
        <button type="button" onClick={() => onChange([...files, { platform: 'windows', label: '', url: '', kind: '' }])} className="btn btn-secondary btn-sm mt-3">
          <Plus size={15} /> Add a link
        </button>
      )}
      {error?.length ? <p className="mt-2 text-[13px] text-danger">{error[0]}</p> : null}
    </div>
  );
}

/* ---------------- screenshots ---------------- */

function ScreenshotEditor({ urls, onChange, error }: { urls: string[]; onChange: (u: string[]) => void; error?: string[] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">Screenshots</span>
        <span className="text-xs tabular-nums text-ink-3">
          {urls.length}/{MAX_SCREENSHOTS}
        </span>
      </div>
      <p className="mb-3 text-[13px] text-ink-3">Optional, and the single best thing you can add. Link images you host; YapBoard doesn’t upload or copy them.</p>
      <div className="space-y-2">
        {urls.map((u, i) => (
          <div key={i} className="flex gap-2">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3">
              <Images size={15} />
            </span>
            <input
              className="field h-10 font-mono text-[13px]"
              value={u}
              onChange={(e) => onChange(urls.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="https://…/screenshot.png"
              inputMode="url"
            />
            <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))} className="btn btn-ghost btn-sm shrink-0 text-ink-3 hover:text-danger" aria-label="Remove this screenshot">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      {urls.length < MAX_SCREENSHOTS && (
        <button type="button" onClick={() => onChange([...urls, ''])} className="btn btn-secondary btn-sm mt-3">
          <Plus size={15} /> Add a screenshot
        </button>
      )}
      {error?.length ? <p className="mt-2 text-[13px] text-danger">{error[0]}</p> : null}
    </div>
  );
}

/** A tiny drawing of each header style, so the choice is made by looking rather than by reading four words. */
function ThemeSwatch({ theme, accent }: { theme: keyof typeof THEMES; accent: string }) {
  const base = { background: `color-mix(in srgb, ${accent} 26%, var(--bg))` };
  return (
    <span aria-hidden className="relative block h-12 w-full overflow-hidden" style={base}>
      {theme === 'GLOW' && <span className="absolute -left-4 -bottom-6 size-20 rounded-full blur-xl" style={{ background: accent, opacity: 0.75 }} />}
      {theme === 'GRID' && (
        <span
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, color-mix(in srgb, ${accent} 75%, transparent) 1px, transparent 0)`, backgroundSize: '9px 9px' }}
        />
      )}
      {theme === 'WAVE' && (
        <span
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: `repeating-linear-gradient(115deg, color-mix(in srgb, ${accent} 60%, transparent) 0 6px, transparent 6px 14px)` }}
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
    </span>
  );
}

/* ---------------- shared bits ---------------- */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="card p-6">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </fieldset>
  );
}

function Field({ label, help, error, count, children }: { label?: string; help?: string; error?: string[]; count?: [number, number]; children: React.ReactNode }) {
  return (
    <div>
      {(label || count) && (
        <div className="flex items-baseline justify-between">
          {label && <span className="label">{label}</span>}
          {count && <span className={clsx('text-xs tabular-nums', count[0] > count[1] * 0.92 ? 'text-warn' : 'text-ink-3')}>{count[0]}/{count[1]}</span>}
        </div>
      )}
      {children}
      <AnimatePresence initial={false}>
        {error?.length ? (
          <motion.p key="e" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 text-[13px] text-danger">
            {error[0]}
          </motion.p>
        ) : help ? (
          <p className="mt-1.5 text-[13px] text-ink-3">{help}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ checked, onChange, title, body }: { checked: boolean; onChange: (b: boolean) => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx('flex items-start gap-4 rounded-xl border p-4 text-left transition-colors', checked ? 'border-accent/50 bg-accent-soft' : 'border-line hover:border-line-strong')}
    >
      <span className={clsx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-surface-3')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={clsx('absolute top-0.5 size-4 rounded-full bg-white shadow', checked ? 'right-0.5' : 'left-0.5')} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-3">{body}</span>
      </span>
    </button>
  );
}
