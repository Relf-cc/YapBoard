// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, MessageSquare, PencilLine, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/Reveal';
import { CopyField } from '@/components/CopyField';
import { GlyphScatter } from '@/components/Glyphs';

export const metadata: Metadata = {
  title: 'Listing a bot',
  description: 'How to list a bot on YapBoard: what you need, how to find the IDs, and what happens after you send it in.',
};

/** The things people get stuck on, in the order they hit them. Each one quotes the message the site actually shows. */
const PROBLEMS: [string, string][] = [
  [
    'I @’d my bot and nothing happened',
    'On Yapin’, mentioning a bot in a command picks which bot the command goes to, so /addbot @YourBot was sent to your bot instead of to YapBoard. Use the bot’s ID: /addbot 2b81f05c…',
  ],
  [
    '“That’s my ID, not your bot’s”',
    'You pasted YapBoard’s own ID. You want your bot’s: the one you paste into Server settings → Bots → Have a bot ID? when adding your bot to a server.',
  ],
  [
    '“That bot isn’t in your support server”',
    'Add the bot to the server first. A support server has to be somewhere the bot actually is - that’s part of how we know it’s yours.',
  ],
  [
    '“Only the server’s owner or an admin”',
    'You need to be the server’s owner, or have a role with Manage Server. Ask whoever runs it to list the bot, or to give you the role.',
  ],
  [
    '“YapBoard’s bot isn’t in that server yet”',
    'Add YapBoard to the support server (step 1). We ask Yapin’ through our own bot, so it has to be in there before we can check anything.',
  ],
  ['“Someone else already listed this bot”', 'If you run it, open its page and send a removal request. Staff will sort it out.'],
  [
    '“No Yapin’ account has that ID”',
    'That’s usually a server ID pasted into the bot field by mistake. The bot ID is the one you paste into Server settings → Bots.',
  ],
];

export default function BotHelp() {
  const botId = process.env.NEXT_PUBLIC_BOT_ID || '';
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-12">
      <Reveal className="relative">
        <GlyphScatter
          items={[
            { g: 'plus', at: { right: '2%', top: '-10%' }, size: 26, r: 10, accent: true },
            { g: 'squiggle', at: { right: '15%', top: '52%' }, size: 30, r: -6 },
            { g: 'check', at: { right: '5%', top: '92%' }, size: 22, r: -8 },
          ]}
        />
        <p className="eyebrow">Help</p>
        <h1 className="mt-3 text-[34px] sm:text-[44px] font-extrabold leading-tight">Listing a bot</h1>
        <p className="mt-3 max-w-xl text-ink-2 leading-relaxed">Four steps, about two minutes. It’s free, and you can change anything later.</p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-10 card p-6">
          <h2 className="font-bold">What you need first</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-2 leading-relaxed">
            <li>- A bot on Yapin’ that you run.</li>
            <li>
              - A <b className="text-ink">support server</b> for it: a server you own or admin, with the bot in it, where people can get help.
            </li>
          </ul>
          <p className="mt-3 text-sm text-ink-3 leading-relaxed">
            The support server is how we check the bot is yours. Yapin’ doesn’t tell anyone who owns a bot, so we check that you run a server the bot is in instead.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <h2 className="mt-12 text-2xl font-extrabold">The steps</h2>
      </Reveal>

      <div className="mt-5 space-y-4">
        <Step n={1} icon={<Bot size={18} />} title="Put YapBoard in your support server" delay={0.1}>
          <p>
            In Yapin’, open <b className="text-ink-2">Server settings → Bots → Have a bot ID?</b> and paste the ID below. You need Manage Server to add bots.
          </p>
          {botId ? <CopyField value={botId} className="mt-4 max-w-md" /> : <p className="mt-3 text-warn">Set NEXT_PUBLIC_BOT_ID to show the bot ID here.</p>}
          <p className="mt-3 text-ink-3">
            This is the only way we can ask Yapin’ whether you run the server, so nothing else works until it’s in.{' '}
            <Link href="/bot" className="text-accent font-semibold hover:underline">
              More about the bot
            </Link>
            .
          </p>
        </Step>

        <Step n={2} icon={<MessageSquare size={18} />} title="Run /addbot in that server" delay={0.12}>
          <p>
            Type <code className="font-mono text-ink-2">/addbot</code> followed by your bot’s ID - the same one you paste into{' '}
            <b className="text-ink-2">Server settings → Bots</b>. YapBoard replies with a link to the form that already has both IDs filled in, so there’s nothing
            left to copy by hand.
          </p>
          <p className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-warn">
            <b>Don’t @ the bot.</b> On Yapin’, mentioning a bot in a command is how you pick which bot the command goes to - so{' '}
            <code className="font-mono">/addbot @YourBot</code> gets sent to your bot, not to YapBoard, and never reaches us.
          </p>
          <p className="mt-3 text-ink-3">
            Rather do it yourself? Go straight to{' '}
            <Link href="/bots/add" className="text-accent font-semibold hover:underline">
              /bots/add
            </Link>{' '}
            and paste both IDs. Running <code className="font-mono text-ink-2">/info</code> in the server shows you its ID.
          </p>
        </Step>

        <Step n={3} icon={<PencilLine size={18} />} title="Write the listing" delay={0.14}>
          <p>A one-line summary, a description and a few tags. Three things make the difference:</p>
          <ul className="mt-3 space-y-1.5">
            <li>
              - Say what the bot <b className="text-ink-2">does</b> in the first line. “Music bot with playlists and DJ roles”, not “the best bot ever”.
            </li>
            <li>- Write a real description. One line tells people nothing, and it’s the usual reason a listing comes back.</li>
            <li>- Pick tags that actually match. Tags are how people find you.</li>
          </ul>
        </Step>

        <Step n={4} icon={<ShieldCheck size={18} />} title="Send it in, and wait for a check" delay={0.16}>
          <p>
            A staff member reads every bot listing before it goes on the board - usually quickly. Until then it’s only visible to you, and it won’t turn up on the
            board or in search.
          </p>
          <p className="mt-3">
            <b className="text-ink-2">You’ll get a DM</b> from the YapBoard bot either way. If it’s approved, it’s live. If staff ask for changes, the DM says what,
            and so does your manage page: fix it, hit save, and that sends it straight back for review. A knock-back isn’t the end of it.
          </p>
        </Step>
      </div>

      <Reveal delay={0.18}>
        <h2 className="mt-12 text-2xl font-extrabold">Stuck on a message?</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-line divide-y divide-line">
          {PROBLEMS.map(([what, why]) => (
            <div key={what} className="bg-surface px-6 py-5">
              <p className="text-[15px] font-semibold text-ink">{what}</p>
              <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{why}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="mt-12 card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">Ready?</h2>
            <p className="mt-1 text-sm text-ink-3">
              Have a look at the{' '}
              <Link href="/guidelines" className="text-accent font-semibold hover:underline">
                listing guidelines
              </Link>{' '}
              first if you’re not sure what’s allowed.
            </p>
          </div>
          <Link href="/bots/add" className="btn btn-primary shrink-0">
            List your bot
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

function Step({ n, icon, title, children, delay }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
          <h3 className="font-bold">
            <span className="text-ink-3 tabular-nums">{n}.</span> {title}
          </h3>
        </div>
        <div className="mt-3 text-sm text-ink-2 leading-relaxed">{children}</div>
      </div>
    </Reveal>
  );
}
