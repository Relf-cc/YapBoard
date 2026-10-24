import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Bot, Terminal } from 'lucide-react';
import { botEnabled } from '@/lib/env';
import { getUser } from '@/lib/session';
import { ListingForm, type ListingValues } from '@/components/manage/ListingForm';
import { CopyField } from '@/components/CopyField';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = { title: 'Add your server' };

export default async function AddServer({ searchParams }: { searchParams: Promise<{ server?: string }> }) {
  const user = await getUser();
  if (!user) redirect('/login?next=/add');
  const { server } = await searchParams;
  const devMode = !botEnabled();
  const botId = process.env.NEXT_PUBLIC_BOT_ID || '';

  const initial: ListingValues = {
    serverId: (server ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64),
    name: '',
    iconUrl: null,
    memberCount: 0,
    summary: '',
    description: '',
    inviteUrl: '',
    language: 'en',
    nsfw: false,
    unlisted: false,
    accent: '#ff6b4a',
    tags: [],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10">
      <Reveal>
        <p className="eyebrow">List your server</p>
        <h1 className="mt-3 text-[34px] sm:text-[44px] font-extrabold leading-tight">Put your server on the board</h1>
        <p className="mt-3 max-w-2xl text-ink-2 leading-relaxed">Free, takes about two minutes. You can change anything later.</p>
      </Reveal>

      {!devMode && (
        <Reveal delay={0.05}>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Bot size={18} />
                </span>
                <h2 className="font-bold">1. Add the YapBoard bot</h2>
              </div>
              <p className="mt-3 text-sm text-ink-3 leading-relaxed">
                In Yapin’, open <b className="text-ink-2">Server settings → Bots → Have a bot ID?</b> and paste this. It’s how we check the server is yours, and it gives you <code className="font-mono text-ink-2">/bump</code>.
              </p>
              {botId && <CopyField value={botId} className="mt-4" />}
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Terminal size={18} />
                </span>
                <h2 className="font-bold">2. Type /yapboard in your server</h2>
              </div>
              <p className="mt-3 text-sm text-ink-3 leading-relaxed">
                The bot replies with a link back here with your server ID filled in. You need to own the server or have a role with Manage Server.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      <div className="mt-10">
        <ListingForm mode="create" initial={initial} devMode={devMode} />
      </div>
    </div>
  );
}
