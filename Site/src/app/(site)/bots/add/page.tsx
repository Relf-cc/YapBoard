// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Bot, ShieldCheck } from 'lucide-react';
import { botEnabled, env } from '@/lib/env';
import { getUser } from '@/lib/session';
import { withQuery } from '@/lib/next-url';
import { BotListingForm, type BotListingValues } from '@/components/manage/BotListingForm';
import { Reveal } from '@/components/Reveal';
import { GlyphScatter } from '@/components/Glyphs';

export const metadata: Metadata = { title: 'List your bot' };

export default async function AddBot({ searchParams }: { searchParams: Promise<{ bot?: string; server?: string }> }) {
  const user = await getUser();
  const { bot, server } = await searchParams;
  const clean = (v: string | undefined) => (v ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const [botId, supportServerId] = [clean(bot), clean(server)];
  // The prefill rides along through login: /addbot's link is useless if logging in drops it.
  if (!user) redirect(`/login?next=${encodeURIComponent(withQuery('/bots/add', { bot: botId, server: supportServerId }))}`);
  // Ownership goes through the bot's support server. Without the token: dev skips the check, production can't list.
  const offline = !botEnabled() && env.isProd;
  const devMode = !botEnabled() && !env.isProd;

  const initial: BotListingValues = {
    botId,
    supportServerId,
    name: '',
    avatarUrl: null,
    serverCount: 0,
    summary: '',
    description: '',
    inviteUrl: '',
    website: '',
    prefix: '',
    library: '',
    language: 'en',
    nsfw: false,
    unlisted: false,
    accent: '#ff6b4a',
    tags: [],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10">
      <Reveal className="relative">
        <GlyphScatter
          items={[
            { g: 'plus', at: { right: '6%', top: '4%' }, size: 24, r: 10, accent: true },
            { g: 'squiggle', at: { right: '19%', top: '46%' }, size: 32, r: -4 },
            { g: 'check', at: { right: '3%', top: '70%' }, size: 24, r: -8 },
          ]}
        />
        <p className="eyebrow">List your bot</p>
        <h1 className="mt-3 text-[34px] sm:text-[44px] font-extrabold leading-tight">Get your bot in front of servers</h1>
        <p className="mt-3 max-w-2xl text-ink-2 leading-relaxed">Free, takes about two minutes. A staff member checks it before it goes on the board — usually quickly. You can change anything later.</p>
      </Reveal>

      {offline && <div className="card mt-8 p-6 text-sm text-ink-2">Listing bots is switched off right now. Try again later.</div>}

      {!devMode && !offline && (
        <Reveal delay={0.05}>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Bot size={18} />
                </span>
                <h2 className="font-bold">1. Have your bot’s ID ready</h2>
              </div>
              <p className="mt-3 text-sm text-ink-3 leading-relaxed">
                The same ID people paste into <b className="text-ink-2">Server settings → Bots → Have a bot ID?</b> It’s what the Add button hands out, so get it right.
              </p>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <ShieldCheck size={18} />
                </span>
                <h2 className="font-bold">2. Name your support server</h2>
              </div>
              <p className="mt-3 text-sm text-ink-3 leading-relaxed">
                A server you own or admin where people get help with the bot. We check that with Yapin’ before listing anything, which is how we know the bot is yours. List that server here too and the two pages link up.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {!offline && (
        <div className="mt-10">
          <BotListingForm mode="create" initial={initial} devMode={devMode} />
        </div>
      )}
    </div>
  );
}
