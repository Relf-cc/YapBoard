// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GitBranch, ShieldCheck, Sparkles } from 'lucide-react';
import { getUser } from '@/lib/session';
import { limitsFor } from '@/lib/pro';
import { ClientListingForm, type ClientListingValues } from '@/components/manage/ClientListingForm';
import { Reveal } from '@/components/Reveal';
import { GlyphScatter } from '@/components/Glyphs';

export const metadata: Metadata = {
  title: 'List your client',
  description: 'Put your Yapin’ client in front of the people looking for one.',
};

export default async function AddClient() {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/clients/add')}`);

  const initial: ClientListingValues = {
    id: '',
    slug: '',
    name: '',
    summary: '',
    description: '',
    iconUrl: '',
    bannerUrl: '',
    website: '',
    sourceUrl: '',
    framework: '',
    supportServerId: '',
    language: 'en',
    nsfw: false,
    unlisted: false,
    accent: '#ff6b4a',
    theme: 'GLOW',
    screenshots: [],
    platforms: [],
    releaseSource: 'GITHUB',
    repo: '',
    files: [],
    tags: [],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <Reveal className="relative">
        <GlyphScatter
          items={[
            { g: 'plus', at: { right: '6%', top: '4%' }, size: 24, r: 10, accent: true },
            { g: 'squiggle', at: { right: '19%', top: '46%' }, size: 32, r: -4 },
            { g: 'check', at: { right: '3%', top: '70%' }, size: 24, r: -8 },
          ]}
        />
        <p className="eyebrow">List your client</p>
        <h1 className="mt-3 text-[34px] font-extrabold leading-tight sm:text-[44px]">Your build of Yapin’, where people can find it</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">
          Free. Point us at your GitHub releases and the download buttons build themselves. A staff member checks every
          client before it goes on the board, because these are files people run on their own machines.
        </p>
        <p className="mt-2 text-sm text-ink-3">
          Read the{' '}
          <Link href="/clients/terms" className="font-semibold text-accent hover:underline">
            client terms
          </Link>{' '}
          first - you’ll be asked to accept them when you submit.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Step icon={<GitBranch size={18} />} n={1} title="Point at your releases">
            Paste the GitHub repo. We read <b className="text-ink-2">releases/latest</b> and sort its files by platform -
            .exe to Windows, .deb and .AppImage to Linux, .dmg to macOS - and show the release notes as your changelog.
          </Step>
          <Step icon={<Sparkles size={18} />} n={2} title="Make the page yours">
            Icon, banner, header style, accent colour and up to six screenshots. Not a template with your name in it.
          </Step>
          <Step icon={<ShieldCheck size={18} />} n={3} title="Staff take a look">
            We check the downloads go where you say they do. The YapBoard bot DMs you the decision either way, and a
            denial just asks for changes - fix it, save, and it goes back in the queue.
          </Step>
        </div>
      </Reveal>

      <div className="mt-10">
        <ClientListingForm mode="create" initial={initial} limits={limitsFor('client', false)} />
      </div>
    </div>
  );
}

function Step({ icon, n, title, children }: { icon: React.ReactNode; n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
        <h2 className="font-bold">
          {n}. {title}
        </h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-3">{children}</p>
    </div>
  );
}
