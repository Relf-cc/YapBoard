'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { sortBadges } from '@/lib/badges';
import { LANGUAGES } from '@/lib/languages';
import type { Limits, ListingLink } from '@/lib/pro-fields';
import { Dropdown } from '../Dropdown';
import { ServerCard } from '../ServerCard';
import { TagInput } from './TagInput';
import { AltLanguageEditor, EventEditor, LinksEditor, ProLock, ScreenshotEditor, ThemePicker } from './ProFields';

const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }));

export const ACCENTS = ['#ff6b4a', '#ffb86b', '#f5d76e', '#7ee2a8', '#3fc1a8', '#5aa9e6', '#8fb8ff', '#5865f2', '#c7a4ff', '#ff9ecb', '#ff5c8a', '#e0304a'];

export type ListingValues = {
  serverId: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  summary: string;
  description: string;
  inviteUrl: string;
  language: string;
  nsfw: boolean;
  unlisted: boolean;
  broadcastsOff: boolean;
  accent: string;
  tags: string[];
  /** Pro perks. Sent whatever the plan says; the route drops them unless the caps allow (lib/servers.ts). */
  theme: string;
  screenshots: string[];
  links: ListingLink[];
  eventTitle: string | null;
  eventAt: string | null;
  eventUrl: string | null;
  altLanguage: string | null;
  altSummary: string | null;
  altDescription: string | null;
  /** Staff-granted badges; shown in the preview, never sent. */
  badges?: string[];
};

type Errors = Partial<Record<keyof ListingValues, string[]>>;

/**
 * `limits` is what this listing may contain, which depends on whether a Pro plan covers it, and `pro`
 * draws the mark in the preview. Both are worked out on the server (src/lib/pro.ts) - the form only ever
 * reads them, so a tampered page buys nobody anything: the route works the caps out again for itself.
 */
export function ListingForm({ mode, initial, devMode, limits, pro }: { mode: 'create' | 'edit'; initial: ListingValues; devMode: boolean; limits: Limits; pro: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const set = <K extends keyof ListingValues>(k: K, val: ListingValues[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(initial), [v, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('saving');
    setFormError('');
    const body = { ...v, ...(mode === 'create' && devMode ? {} : { name: undefined }) };
    const res = await fetch(mode === 'create' ? '/api/servers' : `/api/servers/${initial.serverId}`, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors(out.fields ?? {});
      setFormError(out.fields ? 'A few things need fixing.' : out.error || 'Something went wrong.');
      setState('idle');
      return;
    }
    if (mode === 'create') {
      router.push(`/manage/${out.id}?created=1`);
      return;
    }
    setState('saved');
    router.refresh();
    setTimeout(() => setState('idle'), 1800);
  }

  const preview = {
    id: v.serverId || 'preview',
    name: v.name || 'Your server',
    iconUrl: v.iconUrl,
    summary: v.summary || 'Your one-liner shows up here. Make it count.',
    memberCount: v.memberCount,
    bumpedAt: new Date().toISOString(),
    language: v.language,
    nsfw: v.nsfw,
    accent: v.accent,
    badges: sortBadges(v.badges ?? []),
    tags: v.tags.length ? v.tags : ['your-tags'],
    // Only read by the card's Pro mark; a preview has no owner to look up.
    ownerId: '',
    pro,
    eventTitle: v.eventTitle,
    eventAt: v.eventAt,
  };

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_360px]" noValidate>
      <div className="space-y-8 min-w-0">
        {mode === 'create' && (
          <Section title="Server" hint={devMode ? 'Dev mode: ownership isn’t checked, so you can use any ID.' : 'Run /yapboard in your server and click the link to fill this in.'}>
            <div className={clsx('grid gap-4', devMode && 'sm:grid-cols-2')}>
              <Field label="Server ID" error={errors.serverId}>
                <input className="field font-mono text-sm" value={v.serverId} onChange={(e) => set('serverId', e.target.value.trim())} placeholder="e.g. 7f3c9a1e…" required />
              </Field>
              {devMode && (
                <Field label="Server name" error={errors.name}>
                  <input className="field" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="The Yap Shack" maxLength={100} />
                </Field>
              )}
            </div>
          </Section>
        )}

        <Section title="Pitch" hint="This is what people read before deciding to click.">
          <Field label="One-liner" error={errors.summary} count={[v.summary.length, 140]}>
            <input className="field" value={v.summary} maxLength={140} onChange={(e) => set('summary', e.target.value)} placeholder="Chill late-night gaming crew. Mostly Valorant, sometimes chaos." />
          </Field>
          <Field label="Description" error={errors.description} count={[v.description.length, limits.description]} help="Markdown: **bold**, *italic*, `code`, [text](url), - lists, 1. numbered, # headings, --- dividers, and \`\`\`code blocks\`\`\`.">
            <textarea
              className="field"
              rows={9}
              maxLength={limits.description}
              value={v.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={'What happens in your server? Who is it for?\n\n- Weekly game nights\n- Friendly mods\n- No drama'}
            />
          </Field>
        </Section>

        <Section title="Join link">
          <Field label="Yapin’ invite" error={errors.inviteUrl} help="Make it a link that doesn’t expire, so the Join button keeps working.">
            <input className="field" value={v.inviteUrl} onChange={(e) => set('inviteUrl', e.target.value)} placeholder="https://yapin.gg/invite/your-server" inputMode="url" />
          </Field>
        </Section>

        <Section title="Tags" hint={`Up to ${limits.tags}. These drive search, so pick what people would type.`}>
          <Field error={errors.tags}>
            <TagInput value={v.tags} onChange={(t) => set('tags', t)} invalid={!!errors.tags} max={limits.tags} />
          </Field>
        </Section>

        {mode === 'edit' && (
          <Section title="Your page" hint="How /view looks when somebody lands on it.">
            {limits.themes ? (
              <Field label="Header style" help="How the top of your page is drawn when your server has no banner - and over it when it does.">
                <ThemePicker value={v.theme} onChange={(t) => set('theme', t)} accent={v.accent} idPrefix="server" />
              </Field>
            ) : (
              <ProLock title="Header style" body="Four ways to draw the top of your page, built from your accent colour, instead of the default." />
            )}

            {limits.screenshots > 0 ? (
              <ScreenshotEditor
                urls={v.screenshots}
                onChange={(u) => set('screenshots', u)}
                error={errors.screenshots}
                max={limits.screenshots}
                hint="A gallery on your page. Show the channels, the events, the bots - whatever makes it worth joining."
              />
            ) : (
              <ProLock title="Screenshots" body="A gallery on your server page, up to six images. People decide from pictures long before they read a description." />
            )}

            {limits.links > 0 ? (
              <LinksEditor links={v.links} onChange={(l) => set('links', l)} error={errors.links} max={limits.links} />
            ) : (
              <ProLock title="Extra buttons" body="Up to three of your own buttons beside Join - a website, a wiki, a shop." />
            )}
          </Section>
        )}

        {mode === 'edit' && (
          <Section title="Reach" hint="Two ways to be found by people who'd otherwise scroll past.">
            {limits.events ? (
              <EventEditor
                value={{ eventTitle: v.eventTitle, eventAt: v.eventAt, eventUrl: v.eventUrl }}
                onChange={(patch) => setV((x) => ({ ...x, ...patch }))}
                errors={errors}
              />
            ) : (
              <ProLock
                title="What’s on"
                body="Put your next event on your page and your card, in each reader’s own timezone. It takes itself down once it’s over."
              />
            )}

            {limits.altLanguage ? (
              <AltLanguageEditor
                value={{ altLanguage: v.altLanguage, altSummary: v.altSummary, altDescription: v.altDescription }}
                onChange={(patch) => setV((x) => ({ ...x, ...patch }))}
                errors={errors}
                languages={LANGUAGE_OPTIONS}
                mainLanguage={v.language}
                descriptionMax={limits.description}
              />
            ) : (
              <ProLock
                title="Second language"
                body="Write your pitch in one more language and the listing turns up in that language’s results too, in those words."
              />
            )}
          </Section>
        )}

        <Section title="Details">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Main language" error={errors.language}>
              <Dropdown label="Main language" value={v.language} onChange={(l) => set('language', l)} options={LANGUAGE_OPTIONS} />

            </Field>
            <Field label="Page colour">
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
                      <motion.span layoutId="accent-ring" className="absolute -inset-1 rounded-full border-2 border-ink" transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
                    )}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-6 grid gap-3">
            <Toggle checked={v.nsfw} onChange={(b) => set('nsfw', b)} title="18+ server" body="Hidden from search unless people turn on 18+ results. Required if your server has adult content." />
            <Toggle checked={v.unlisted} onChange={(b) => set('unlisted', b)} title="Unlisted" body="Keep the page, but leave it out of search and browse. Anyone with the link can still see it." />
            <Toggle
              checked={v.broadcastsOff}
              onChange={(b) => set('broadcastsOff', b)}
              title="No announcements from YapBoard"
              body="We occasionally post something worth knowing in the channel you bump from. Turn this on and we won’t."
            />
          </div>
        </Section>
      </div>

      {/* preview + save */}
      <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">Live preview</p>
        <div className="pointer-events-none">
          <ServerCard server={preview} />
        </div>

        <div className="card p-4">
          <AnimatePresence>
            {formError && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-sm text-danger mb-3">
                {formError}
              </motion.p>
            )}
          </AnimatePresence>
          <button className="btn btn-primary btn-lg w-full" disabled={state === 'saving' || (mode === 'edit' && !dirty && state !== 'saved')}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={state} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-2">
                {state === 'saving' && <Loader2 size={17} className="animate-spin" />}
                {state === 'saved' && <Check size={17} />}
                {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : mode === 'create' ? 'Publish listing' : 'Save changes'}
              </motion.span>
            </AnimatePresence>
          </button>
          {mode === 'create' && <p className="mt-3 text-xs text-ink-3 text-center leading-relaxed">By listing you agree to the listing guidelines.</p>}
        </div>
      </div>
    </form>
  );
}

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
        <span className="block mt-0.5 text-[13px] text-ink-3 leading-relaxed">{body}</span>
      </span>
    </button>
  );
}
