// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Ban, Check, CircleCheck, Lightbulb } from 'lucide-react';
import { apiRoot, platformBase, requireMemberPage } from '@/lib/platform';
import { CodeTabs } from '@/components/platform/Code';
import { PageHead } from '@/components/portal/PageHead';

export const metadata: Metadata = { title: 'Requirements & code' };

/**
 * What an integration has to do, and code that already does it.
 *
 * Every snippet on this page was run against the API before it was pasted in, so a member copying one gets
 * something that works rather than something that reads like it would. Keep it that way: if an endpoint
 * changes shape, run the snippet again before editing it here.
 */

type Rule = { h: string; why: string };

const MUST: Rule[] = [
  {
    h: 'Offer to list a server that isn’t listed',
    why: 'When /bump runs somewhere with no listing, the API answers `not_found` and hands you `addUrl`. You must show it, as a clear invitation to list the server — not a silent failure, not a bare error. Somebody typing /bump has already told you they want their server found; this is the moment that works.',
  },
  {
    h: 'Send the person who ran the command',
    why: 'The `user` object is the account that typed it — never your bot, never an owner you looked up. Bumps are credited to people, banned accounts are turned down, and a bump nobody asked for is the fastest way out of the programme.',
  },
  {
    h: 'Send the real serverId on bot and client bumps',
    why: 'Those bumps are only allowed from a listing’s own server, so the `serverId` you send decides whether they land. Send where the command actually came from. We can’t prove it from outside Yapin’, which is why misreporting it is a breach rather than an error.',
  },
  {
    h: 'Show the cooldown instead of retrying',
    why: 'A refusal carries `nextAt`. Put it in front of the person (“again in 1h 12m”) and stop. Retrying in a loop spends your rate limit and reads as abuse from here.',
  },
  {
    h: 'Handle every refusal, and every 429',
    why: '`ok: false` is an answer, not an exception: cooldown, not_found, not_listed, wrong_server and banned each deserve their own sentence. A 429 means wait — back off, don’t hammer.',
  },
  {
    h: 'Keep keys on your server',
    why: 'Not in a repository, not in a client, not in a config your users can read. Every call made with your key is treated as yours. If one leaks, revoke it on the app’s page and mint a replacement.',
  },
  {
    h: 'Say listings come from YapBoard, and link them',
    why: 'Where you show a listing, name the source and link it, so people can reach the listing you’re quoting. Don’t imply we endorse your bot beyond your membership.',
  },
  {
    h: 'Keep your app’s contact current',
    why: 'It’s where we write before we switch anything off. An app with a dead contact gets suspended rather than discussed.',
  },
];

const NEVER: Rule[] = [
  {
    h: 'Bump on a timer, a schedule, or on join',
    why: 'A bump has to be a person asking, in the moment, for a listing they chose. Cron jobs, loops, reminders that bump on someone’s behalf, bumping as a side effect of another command — all of it ends a membership, because it moves real listings that someone else owns.',
  },
  {
    h: 'Reward, require or pressure bumping',
    why: 'No bump-for-roles, no bump-to-unlock, no giveaway entries, no leaderboards that pay out. The board is meant to say “the people here use this”.',
  },
  {
    h: 'Bump listings that have nothing to do with the server',
    why: 'A bot or client may only be bumped from its support server, or a server its lister owns. One busy server is not a bump farm for a shelf of other people’s bots.',
  },
  {
    h: 'Mirror, index or republish the boards',
    why: 'Search answers somebody’s question in chat. Copying listings into your own directory, dataset, feed or API isn’t covered by the licence.',
  },
  {
    h: 'Share a key, or run several bots from one app',
    why: 'One app is one bot. Another developer wanting access can be invited themselves; lending them yours makes their calls your responsibility.',
  },
  {
    h: 'Work around a limit',
    why: 'No second key to double a quota, no second app for one bot, no proxying calls to disguise where they came from, no retry loop against a refusal.',
  },
];

const SHOULD: Rule[] = [
  {
    h: 'Cache reads for a minute or so',
    why: 'Listing lookups and searches change slowly. Caching briefly keeps you well inside the rate limit and makes your commands feel instant.',
  },
  {
    h: 'Degrade gracefully when we’re down',
    why: '“Couldn’t reach YapBoard” is a better answer than a stack trace — and it isn’t the same sentence as “not listed”.',
  },
  {
    h: 'Check your scopes at boot',
    why: 'Call /me when your bot starts and log what’s missing. It turns a config mistake into a line in your own logs rather than a 403 in front of a user.',
  },
];

const REASONS: [string, string, string][] = [
  ['not_found', 'Nothing is listed for that ID', 'Show `addUrl` and invite them to list it. Required.'],
  ['not_listed', 'A listing exists but isn’t public', 'Say so and link the listing; the owner can make it public.'],
  ['cooldown', 'Bumped too recently', 'Show `nextAt`. Don’t retry.'],
  ['wrong_server', 'A bot or client bump from a server it doesn’t belong to', 'Explain it can only be bumped from its support server.'],
  ['banned', 'That account is banned from YapBoard', 'Say the account can’t bump. Don’t retry as someone else.'],
];

export default async function Requirements() {
  await requireMemberPage('/requirements');
  const base = await platformBase();
  const root = apiRoot();

  return (
    <div className="max-w-4xl">
      <PageHead title="Requirements & code" sub="What an integration has to do, and code that already does it." />

      {/* The one requirement that pays for the API, so it goes first and loud. */}
      <section className="card border-accent-line bg-accent-soft/30 p-5">
        <h2 className="flex items-center gap-2 font-display text-[19px] font-bold">
          <AlertTriangle size={18} className="text-accent" />
          Required: /bump in an unlisted server must offer to list it
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">
          If someone runs your bump command in a server that isn’t on YapBoard, the API answers{' '}
          <code className="font-mono text-[13px] text-ink">{'{ "ok": false, "reason": "not_found" }'}</code> with an{' '}
          <code className="font-mono text-[13px] text-ink">addUrl</code> for that exact server. Put it in front of them.
        </p>
        <CodeTabs
          className="mt-4"
          tabs={[
            { label: 'JavaScript', lang: 'js', code: `// REQUIRED: a bump in a server that isn't listed has to offer to list it.
case 'not_found':
  return msg.reply(\`**\${msg.server.name}** isn’t on YapBoard yet — list it and people can find it:\\n\${r.addUrl}\`);` },
            { label: 'Python', lang: 'py', code: `# REQUIRED: a bump in a server that isn't listed has to offer to list it.
if reason == "not_found":
    return await ctx.reply(
        f"**{ctx.server.name}** isn't on YapBoard yet - list it and people can find it:\\n{r['addUrl']}"
    )` },
          ]}
        />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
          Why it’s required: somebody typing /bump has already said they want their server found. A bot that swallows that moment takes the useful
          half of the API and gives nothing back to the board it reads from.
        </p>
      </section>

      <RuleList id="must" title="You must" icon={<CircleCheck size={17} className="text-ok" />} rules={MUST} />
      <RuleList id="never" title="You must not" icon={<Ban size={17} className="text-danger" />} rules={NEVER} tone="danger" />
      <RuleList id="should" title="You should" icon={<Lightbulb size={17} className="text-warn" />} rules={SHOULD} tone="muted" />

      <section className="mt-10">
        <h2 className="font-display text-[20px] font-bold">Refusals, and what to say</h2>
        <p className="mt-1 text-sm text-ink-3">
          A refusal is a 200 with <code className="font-mono text-[12px]">ok: false</code>. Only a broken request is a 4xx.
        </p>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="h-11 px-5 font-medium">reason</th>
                <th className="px-3 font-medium">What happened</th>
                <th className="px-5 font-medium">What your bot should say</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {REASONS.map(([reason, what, say]) => (
                <tr key={reason}>
                  <td className="px-5 py-3 align-top">
                    <code className="font-mono text-[13px] text-accent">{reason}</code>
                  </td>
                  <td className="px-3 py-3 align-top text-ink-2">{what}</td>
                  <td className="px-5 py-3 align-top text-ink-3">{say}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-8">
        <div>
          <h2 className="font-display text-[20px] font-bold">Code</h2>
          <p className="mt-1 text-sm text-ink-3">
            Two languages, and all of it run against <code className="font-mono text-[12px] text-ink-2">{root}</code> before it was pasted here. Drop
            in your key and it works.
          </p>
        </div>

        <Snippet
          title="1. The API wrapper"
          note="One place that knows about keys, timeouts and 429s, so your command handlers stay about commands."
          jsLabel="yapboard.js"
          pyLabel="yapboard.py"
          js={`// yapboard.js — one place for the API, so a command handler stays short.
const BASE = process.env.YAPBOARD_API ?? 'https://api.yapboard.dev/platform/v1';
const KEY = process.env.YAPBOARD_KEY; // from the environment, never from the repo

export class RateLimited extends Error {}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers: { authorization: \`Bearer \${KEY}\`, ...(body && { 'content-type': 'application/json' }) },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  // 429 means you are over the per-minute limit: wait, don't retry in a loop.
  if (res.status === 429) throw new RateLimited(path);
  if (!res.ok) throw new Error(data.error ?? \`YapBoard \${res.status}\`);
  return data;
}

export const whoAmI = () => call('/me');
export const bumpServer = (serverId, user, extra = {}) => call(\`/servers/\${serverId}/bump\`, { method: 'POST', body: { user, ...extra } });
export const bumpBot = (botId, user, serverId) => call(\`/bots/\${botId}/bump\`, { method: 'POST', body: { user, serverId } });
export const searchServers = (q, limit = 5) => call(\`/search/servers?q=\${encodeURIComponent(q)}&limit=\${limit}\`);`}
          py={`# yapboard.py - one place for the API, so a command handler stays short.
import os
from datetime import datetime, timezone
from urllib.parse import quote

import requests

BASE = os.environ.get("YAPBOARD_API", "https://api.yapboard.dev/platform/v1")
KEY = os.environ["YAPBOARD_KEY"]  # from the environment, never from the repo

SESSION = requests.Session()
SESSION.headers["Authorization"] = f"Bearer {KEY}"


class RateLimited(Exception):
    pass


def call(path, method="GET", body=None):
    r = SESSION.request(method, BASE + path, json=body, timeout=10)
    # 429 means you are over the per-minute limit: wait, don't retry in a loop.
    if r.status_code == 429:
        raise RateLimited(path)
    data = r.json() if r.content else {}
    if not r.ok:
        raise RuntimeError(data.get("error", f"YapBoard {r.status_code}"))
    return data


def who_am_i():
    return call("/me")


def bump_server(server_id, user, **extra):
    return call(f"/servers/{server_id}/bump", "POST", {"user": user, **extra})


def bump_bot(bot_id, user, server_id):
    return call(f"/bots/{bot_id}/bump", "POST", {"user": user, "serverId": server_id})


def search_servers(q, limit=5):
    return call(f"/search/servers?q={quote(q)}&limit={limit}")


def until(iso):
    """'1h 12m' from an ISO timestamp, for telling someone when the next bump is."""
    left = datetime.fromisoformat(iso.replace("Z", "+00:00")) - datetime.now(timezone.utc)
    mins = max(0, -(-int(left.total_seconds()) // 60))
    return f"{mins // 60}h {mins % 60}m" if mins >= 60 else f"{mins}m"`}
        />

        <Snippet
          title="2. The /bump command"
          note="Every branch the API can answer with, including the required one. If you copy one thing, copy this."
          jsLabel="bump.js"
          pyLabel="bump.py"
          js={`import { bumpServer } from './yapboard.mjs';

/** "1h 12m" from an ISO timestamp, for telling someone when the next bump is. */
const until = (iso) => {
  const mins = Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 60_000));
  return mins >= 60 ? \`\${Math.floor(mins / 60)}h \${mins % 60}m\` : \`\${mins}m\`;
};

/** /bump in a server. Swap \`msg\` for whatever your framework hands a command. */
export async function onBump(msg) {
  const user = {
    id: msg.author.id,
    username: msg.author.username,
    displayName: msg.author.displayName,
    avatarUrl: msg.author.avatarUrl,
  };

  const r = await bumpServer(msg.serverId, user, { memberCount: msg.server.memberCount, channelId: msg.channelId });

  if (r.ok) {
    return msg.reply(\`Bumped **\${r.server.name}** — \${r.bumpCount} bumps. You can bump again in \${until(r.nextAt)}.\\n\${r.url}\`);
  }

  switch (r.reason) {
    // REQUIRED: a bump in a server that isn't listed has to offer to list it.
    case 'not_found':
      return msg.reply(\`**\${msg.server.name}** isn’t on YapBoard yet — list it and people can find it:\\n\${r.addUrl}\`);
    case 'not_listed':
      return msg.reply(\`This server’s YapBoard listing isn’t public, so it can’t be bumped.\\n\${r.url}\`);
    case 'cooldown':
      return msg.reply(\`Already bumped recently. Next one in \${until(r.nextAt)}.\`);
    case 'banned':
      return msg.reply('That account can’t bump on YapBoard.');
    default:
      return msg.reply('Couldn’t bump just now — try again in a bit.');
  }
}`}
          py={`from yapboard import bump_server, until


async def on_bump(ctx):
    """/bump in a server. Swap \`ctx\` for whatever your framework hands a command."""
    user = {
        "id": str(ctx.author.id),
        "username": ctx.author.username,
        "displayName": ctx.author.display_name,
    }

    r = bump_server(
        str(ctx.server.id),
        user,
        memberCount=ctx.server.member_count,
        channelId=str(ctx.channel.id),
    )

    if r["ok"]:
        return await ctx.reply(
            f"Bumped **{r['server']['name']}** - {r['bumpCount']} bumps. "
            f"You can bump again in {until(r['nextAt'])}.\\n{r['url']}"
        )

    reason = r.get("reason")
    # REQUIRED: a bump in a server that isn't listed has to offer to list it.
    if reason == "not_found":
        return await ctx.reply(
            f"**{ctx.server.name}** isn't on YapBoard yet - list it and people can find it:\\n{r['addUrl']}"
        )
    if reason == "not_listed":
        return await ctx.reply(f"This server's YapBoard listing isn't public, so it can't be bumped.\\n{r['url']}")
    if reason == "cooldown":
        return await ctx.reply(f"Already bumped recently. Next one in {until(r['nextAt'])}.")
    if reason == "banned":
        return await ctx.reply("That account can't bump on YapBoard.")
    return await ctx.reply("Couldn't bump just now - try again in a bit.")`}
        />

        <Snippet
          title="3. Bumping your own bot or client"
          note="These take the server the command came from, and only work from the listing’s own server."
          js={`const r = await bumpBot(MY_BOT_ID, user, msg.serverId);

if (!r.ok && r.reason === 'wrong_server') {
  // Not this bot's server. r.detail says why, in words you can show.
  return msg.reply('You can only bump this bot from its support server.');
}`}
          py={`r = bump_bot(MY_BOT_ID, user, str(ctx.server.id))

if not r["ok"] and r.get("reason") == "wrong_server":
    # Not this bot's server. r["detail"] says why, in words you can show.
    return await ctx.reply("You can only bump this bot from its support server.")`}
        />

        <Snippet
          title="4. Checking your key at boot"
          note="Turns a missing scope into a line in your logs instead of a 403 in front of a user."
          js={`// On boot, say out loud what the key can do. A missing scope is a config problem,
// not something to discover in front of a user.
import { whoAmI } from './yapboard.js';

const need = ['bump', 'search'];
const me = await whoAmI();
const missing = need.filter((s) => !me.scopes.includes(s));
if (missing.length) console.warn('YapBoard: key is missing scopes: ' + missing.join(', '));
else console.log(\`YapBoard: \${me.app.name} ready, \${me.rate.bumpPerMinute} bumps/min\`);`}
          py={`# On boot, say out loud what the key can do. A missing scope is a config problem,
# not something to discover in front of a user.
from yapboard import who_am_i

NEED = ("bump", "search")
me = who_am_i()
missing = [s for s in NEED if s not in me["scopes"]]
if missing:
    print("YapBoard: key is missing scopes:", ", ".join(missing))
else:
    print(f"YapBoard: {me['app']['name']} ready, {me['rate']['bumpPerMinute']} bumps/min")`}
        />
      </section>

      <section className="card mt-12 p-5">
        <h2 className="font-bold">Before you ship</h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
          {[
            'Unlisted server shows the add link',
            'Cooldown shows a time, never retries',
            'The person is sent, not the bot',
            'Bot and client bumps send the real serverId',
            'Key is in the environment, not the repo',
            '429 and network errors are caught',
            'Listings are credited and linked',
            'Contact on your app still reaches you',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-ok" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-ink-3">
          These requirements are part of the{' '}
          <Link href={base + '/program'} className="font-medium text-accent hover:underline">
            platform terms
          </Link>
          . The{' '}
          <Link href={base + '/docs'} className="font-medium text-accent hover:underline">
            reference
          </Link>{' '}
          has every endpoint in full.
        </p>
      </section>
    </div>
  );
}

/** One titled group of rules, each with the reason it exists - a rule without a why gets argued with. */
function RuleList({ id, title, icon, rules, tone }: { id: string; title: string; icon: React.ReactNode; rules: Rule[]; tone?: 'danger' | 'muted' }) {
  const n = tone === 'danger' ? 'text-danger' : tone === 'muted' ? 'text-ink-3' : 'text-accent';
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="flex items-center gap-2 font-display text-[20px] font-bold">
        {icon}
        {title}
      </h2>
      <ol className="mt-4 grid gap-3">
        {rules.map((r, i) => (
          <li key={r.h} className="card p-4">
            <div className="flex gap-3">
              <span className={'font-display text-[15px] font-extrabold leading-6 tabular-nums ' + n}>{i + 1}</span>
              <div className="min-w-0">
                <h3 className="font-semibold">{r.h}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{r.why}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A numbered snippet in both languages, with the file name on the tab where there is one. */
function Snippet({ title, note, js, py, jsLabel, pyLabel }: { title: string; note: string; js: string; py: string; jsLabel?: string; pyLabel?: string }) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 mb-3 text-[13.5px] leading-relaxed text-ink-3">{note}</p>
      <CodeTabs
        tabs={[
          { label: jsLabel ?? 'JavaScript', lang: 'js', code: js },
          { label: pyLabel ?? 'Python', lang: 'py', code: py },
        ]}
      />
    </div>
  );
}
