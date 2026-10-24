import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal';
import { CopyField } from '@/components/CopyField';
import { LogoMark } from '@/components/Logo';
import { GlyphScatter } from '@/components/Glyphs';

export const metadata: Metadata = { title: 'The YapBoard bot' };

const COMMANDS: [string, string][] = [
  ['/bump', 'Moves your server to the top of the list. Anyone in the server can do it, once every 2 hours.'],
  ['/yapboard', 'Shows your listing’s stats, or a link to list the server if it isn’t on YapBoard yet.'],
  ['/invite', 'Gets the link to add YapBoard to another server.'],
  ['/help', 'Lists the commands.'],
];

export default function BotPage() {
  const botId = process.env.NEXT_PUBLIC_BOT_ID || '';
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-12">
      <Reveal className="relative">
        <GlyphScatter
          items={[
            { g: 'chevrons', at: { right: '3%', top: '-14%' }, size: 28, r: 8, accent: true },
            { g: 'hash', at: { right: '16%', top: '34%' }, size: 24, r: -10 },
            { g: 'ring', at: { right: '7%', top: '78%' }, size: 14 },
          ]}
        />
        <div className="flex items-center gap-4">
          <LogoMark size={56} />
          <div>
            <h1 className="text-[34px] sm:text-[44px] font-extrabold leading-none">The YapBoard bot</h1>
            <p className="mt-2 text-ink-2">Proves you run the server, and lets your members bump it.</p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-10 card p-6">
          <h2 className="font-bold">Add it to your server</h2>
          <p className="mt-2 text-sm text-ink-3 leading-relaxed">
            In Yapin’, open <b className="text-ink-2">Server settings → Bots → Have a bot ID?</b> and paste the ID below. You need Manage Server to add bots.
          </p>
          {botId ? <CopyField value={botId} className="mt-4 max-w-md" /> : <p className="mt-4 text-sm text-warn">Set NEXT_PUBLIC_BOT_ID to show the bot ID here.</p>}
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <h2 className="mt-12 text-2xl font-extrabold">Commands</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-line divide-y divide-line">
          {COMMANDS.map(([cmd, body]) => (
            <div key={cmd} className="grid sm:grid-cols-[160px_1fr] gap-2 sm:gap-6 bg-surface px-6 py-5">
              <code className="font-mono text-[15px] font-semibold text-accent">{cmd}</code>
              <p className="text-sm text-ink-2 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <p className="mt-10 text-sm text-ink-3">
          Ready? <Link href="/add" className="text-accent font-semibold hover:underline">List your server →</Link>
        </p>
      </Reveal>
    </div>
  );
}
