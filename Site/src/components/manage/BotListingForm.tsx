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
import { Dropdown } from '../Dropdown';
import { BotCard } from '../BotCard';
import { TagInput } from './TagInput';
import type { Limits } from '@/lib/pro-fields';
import { ACCENTS } from './ListingForm';

const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }));

export type BotListingValues = {
  botId: string;
  /** The server that supports the bot. On create it's how we check the bot is yours; after that it's a link. */
  supportServerId: string;
  name: string;
  avatarUrl: string | null;
  serverCount: number;
  summary: string;
  description: string;
  inviteUrl: string;
  website: string;
  prefix: string;
  library: string;
  language: string;
  nsfw: boolean;
  unlisted: boolean;
  accent: string;
  tags: string[];
  /** Staff-granted badges; shown in the preview, never sent. */
  badges?: string[];
};

type Errors = Partial<Record<keyof BotListingValues, string[]>>;

export function BotListingForm({ mode, initial, devMode, limits }: { mode: 'create' | 'edit'; initial: BotListingValues; devMode: boolean; limits: Limits }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const set = <K extends keyof BotListingValues>(k: K, val: BotListingValues[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(initial), [v, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('saving');
    setFormError('');
    const body = { ...v, ...(mode === 'create' && devMode ? {} : { name: undefined }) };
    const res = await fetch(mode === 'create' ? '/api/bots' : `/api/bots/${initial.botId}`, {
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
      // The listing is queued, not live: the manage page explains where it stands.
      router.push(`/bots/${out.id}/manage?created=1`);
      return;
    }
    setState('saved');
    router.refresh();
    setTimeout(() => setState('idle'), 1800);
  }

  const preview = {
    id: v.botId || 'preview',
    name: v.name || 'Your bot',
    avatarUrl: v.avatarUrl,
    summary: v.summary || 'Your one-liner shows up here. Make it count.',
    serverCount: v.serverCount,
    bumpedAt: new Date().toISOString(),
    language: v.language,
    nsfw: v.nsfw,
    accent: v.accent,
    prefix: v.prefix || null,
    badges: sortBadges(v.badges ?? []),
    tags: v.tags.length ? v.tags : ['your-tags'],
  };

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_360px]" noValidate>
      <div className="space-y-8 min-w-0">
        {mode === 'create' && (
          <Section title="The bot" hint={devMode ? 'Dev mode: nothing is checked, so you can use any IDs.' : 'We check you run the bot’s support server before listing it.'}>
            <div className={clsx('grid gap-4', devMode && 'sm:grid-cols-2')}>
              <Field label="Bot ID" error={errors.botId} help="The ID people paste into Server settings → Bots.">
                <input className="field font-mono text-sm" value={v.botId} onChange={(e) => set('botId', e.target.value.trim())} placeholder="e.g. 7f3c9a1e…" required />
              </Field>
              {devMode && (
                <Field label="Bot name" error={errors.name}>
                  <input className="field" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Yapper" maxLength={100} />
                </Field>
              )}
            </div>
            <Field label="Support server ID" error={errors.supportServerId} help="A server you own or admin, with the bot in it, where people get help with it. This is how we check the bot is yours.">
              <input className="field font-mono text-sm" value={v.supportServerId} onChange={(e) => set('supportServerId', e.target.value.trim())} placeholder="e.g. 2b81f05c…" required />
            </Field>
          </Section>
        )}

        <Section title="Pitch" hint="This is what people read before deciding to add it.">
          <Field label="One-liner" error={errors.summary} count={[v.summary.length, 140]}>
            <input className="field" value={v.summary} maxLength={140} onChange={(e) => set('summary', e.target.value)} placeholder="Music, polls and a terrible sense of humour." />
          </Field>
          <Field label="Description" error={errors.description} count={[v.description.length, limits.description]} help="Markdown: **bold**, *italic*, `code`, [text](url), - lists, 1. numbered, # headings, --- dividers, and \`\`\`code blocks\`\`\`.">
            <textarea
              className="field"
              rows={9}
              maxLength={limits.description}
              value={v.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={'What does your bot do? What are its best commands?\n\n- /play - queue a track\n- /poll - ask the server something\n- Slash commands only, no prefix needed'}
            />
          </Field>
        </Section>

        <Section title="How people use it">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Prefix" error={errors.prefix} help="Leave empty for slash commands only.">
              <input className="field font-mono" value={v.prefix} maxLength={8} onChange={(e) => set('prefix', e.target.value)} placeholder="!" />
            </Field>
            <Field label="Built with" error={errors.library} help="Optional, e.g. yapper.js.">
              <input className="field" value={v.library} maxLength={40} onChange={(e) => set('library', e.target.value)} placeholder="yapper.js" />
            </Field>
          </div>
          <Field label="Add link" error={errors.inviteUrl} help="Optional. Where the Add button sends people. Without one they copy the bot ID from your page.">
            <input className="field" value={v.inviteUrl} onChange={(e) => set('inviteUrl', e.target.value)} placeholder="https://yourbot.example/add" inputMode="url" />
          </Field>
          <Field label="Website" error={errors.website} help="Optional. Docs, dashboard, anything.">
            <input className="field" value={v.website} onChange={(e) => set('website', e.target.value)} placeholder="https://yourbot.example" inputMode="url" />
          </Field>
        </Section>

        {mode === 'edit' && (
          <Section title="Support server" hint="A server listed on YapBoard where people get help with the bot. Clear it to unlink.">
            <Field label="Support server ID" error={errors.supportServerId}>
              <input className="field font-mono text-sm" value={v.supportServerId} onChange={(e) => set('supportServerId', e.target.value.trim())} placeholder="Leave empty for none" />
            </Field>
          </Section>
        )}

        <Section title="Tags" hint="Up to five. These drive search, so pick what people would type.">
          <Field error={errors.tags}>
            <TagInput value={v.tags} onChange={(t) => set('tags', t)} invalid={!!errors.tags} max={limits.tags} />
          </Field>
        </Section>

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
                      <motion.span layoutId="bot-accent-ring" className="absolute -inset-1 rounded-full border-2 border-ink" transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
                    )}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-6 grid gap-3">
            <Toggle checked={v.nsfw} onChange={(b) => set('nsfw', b)} title="18+ bot" body="Hidden from the board unless people turn on 18+ results. Required if it has adult features." />
            <Toggle checked={v.unlisted} onChange={(b) => set('unlisted', b)} title="Unlisted" body="Keep the page, but leave it out of the bot board. Anyone with the link can still see it." />
          </div>
        </Section>
      </div>

      {/* preview + save */}
      <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">Live preview</p>
        <div className="pointer-events-none">
          <BotCard bot={preview} />
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
