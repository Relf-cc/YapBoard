// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Lock, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { apiRoot, platformBase, RATE, readScopes, requireMemberPage, SCOPES, SCOPE_ORDER, type Scope } from '@/lib/platform';
import { CodeBlock, CodeTabs, EndpointLine } from '@/components/platform/Code';
import { CopyField } from '@/components/CopyField';
import { PageHead } from '@/components/portal/PageHead';

export const metadata: Metadata = { title: 'Commands & API' };

/**
 * The reference. Grouped the way a developer reads it - start here, then the thing they came for - with an
 * index that follows the page, one request/response/curl panel per endpoint, and a copy button on every
 * block. The shapes themselves live in DOCS below; the chrome is all presentation.
 */

/** One endpoint, written out the way a developer reads it: what it's for, what goes in, what comes back. */
type Doc = {
  scope: Scope | null;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  blurb: string;
  request?: string;
  response: string;
  notes?: string[];
};

const DOCS: Doc[] = [
  {
    scope: null,
    method: 'GET',
    path: '/me',
    title: 'Who am I',
    blurb: 'Your app as the API sees it. Needs no scope - call it once on boot to check a key and read back what it may do.',
    response: `{
  "app": { "id": "cl\u2026", "botId": "1049283746152839", "name": "Yapbot" },
  "scopes": ["bump", "search"],
  "rate": { "perMinute": ${RATE.perMinute}, "bumpPerMinute": ${RATE.bumpPerMinute} }
}`,
  },

  /* ---- search: one route per board, one shape ---- */
  {
    scope: 'search',
    method: 'GET',
    path: '/search/servers?q=chill&tag=gaming&limit=10',
    title: 'Search servers',
    blurb: 'Public server listings by name or one-liner, newest bumps first. For an in-chat browser, not for mirroring the board.',
    response: `{
  "board": "servers",
  "total": 3,
  "items": [
    {
      "id": "1234567890",
      "name": "Yap Cafe",
      "summary": "Coffee and keyboards.",
      "iconUrl": "https://\u2026",
      "memberCount": 412,
      "tags": ["chill", "gaming"],
      "badges": ["VERIFIED"],
      "url": "https://yapboard.dev/view/1234567890"
    }
  ]
}`,
    notes: [
      'All three searches take the same `q`, `tag` and `limit` (1-25, default 10) and answer with the same `{ board, total, items }`, so one command can render whichever board it was pointed at.',
      'Send `q`, `tag`, or both. NSFW and unlisted listings are left out, so anything you get back is safe to post in a channel.',
    ],
  },
  {
    scope: 'search',
    method: 'GET',
    path: '/search/bots?q=moderation',
    title: 'Search bots',
    blurb: 'Public bot listings, recently bumped first, then by how many servers they are in.',
    response: `{
  "board": "bots",
  "total": 1,
  "items": [
    {
      "id": "1049283746152839",
      "name": "Yapbot",
      "summary": "Moderation, with fewer menus.",
      "avatarUrl": "https://\u2026",
      "prefix": "y!",
      "serverCount": 1840,
      "tags": ["moderation"],
      "badges": ["VERIFIED"],
      "url": "https://yapboard.dev/bots/1049283746152839"
    }
  ]
}`,
  },
  {
    scope: 'search',
    method: 'GET',
    path: '/search/clients?tag=linux',
    title: 'Search clients',
    blurb: 'Public client listings - somebody\u2019s own build of Yapin\u2019 - recently bumped first, then most downloaded.',
    response: `{
  "board": "clients",
  "total": 1,
  "items": [
    {
      "id": "cl\u2026",
      "slug": "yapinplus",
      "name": "Yapin+",
      "summary": "A lighter Yapin\u2019 with themes.",
      "iconUrl": "https://\u2026",
      "platforms": ["windows", "linux"],
      "version": "v1.4.2",
      "downloads": 9120,
      "tags": ["themes", "linux"],
      "badges": [],
      "url": "https://yapboard.dev/clients/yapinplus"
    }
  ]
}`,
    notes: ['A client has no Yapin\u2019 ID of its own, so it carries a `slug` as well. Either one works in the bump path.'],
  },

  /* ---- bumps: one route per board, the person always in the body ---- */
  {
    scope: 'bump',
    method: 'POST',
    path: '/servers/{serverId}/bump',
    title: 'Bump a server',
    blurb: 'The same bump YapBoard\u2019s own /bump makes: the listing moves to the top, on one shared two-hour cooldown.',
    request: `{
  "user": {
    "id": "9876543210",
    "username": "ellie",
    "displayName": "Ellie",          // optional
    "avatarUrl": "https://\u2026"         // optional
  },
  "memberCount": 412,                // optional, keeps the listing fresh
  "channelId": "5566778899"          // optional, where it was typed
}`,
    response: `{
  "ok": true,
  "board": "servers",
  "bumpCount": 38,
  "nextAt": "2026-10-29T14:12:09.000Z",
  "server": { "id": "1234567890", "name": "Yap Cafe", "iconUrl": "https://\u2026", "accent": "#ff6b4a" },
  "url": "https://yapboard.dev/view/1234567890",
  "via": { "appId": "cl\u2026", "botId": "1049283746152839" }
}

// turned down, with a reason rather than an error:
{ "ok": false, "reason": "cooldown", "nextAt": "2026-10-29T14:12:09.000Z" }
// reason: cooldown | not_found | not_listed | banned`,
    notes: [
      'Send the person who typed the command, not your bot. Bumps are credited to them, and a banned account is turned down.',
      'Anyone in a server may bump it, as on the site. The cooldown belongs to the listing and is shared with every other way to bump it - show `nextAt` rather than retrying.',
      'A turned-down bump answers 200 with `ok: false`. Only a broken request answers 4xx.',
      `All bumps share one budget: ${RATE.bumpPerMinute} a minute per app, across the three boards.`,
    ],
  },
  {
    scope: 'bump',
    method: 'POST',
    path: '/bots/{botId}/bump',
    title: 'Bump a bot',
    blurb: 'A bot listing, bumped from the server it belongs to. Same two-hour cooldown.',
    request: `{
  "user": { "id": "9876543210", "username": "ellie" },
  "serverId": "1234567890"           // where the command was typed - required
}`,
    response: `{
  "ok": true,
  "board": "bots",
  "bumpCount": 12,
  "nextAt": "2026-10-29T14:12:09.000Z",
  "bot": { "id": "1049283746152839", "name": "Yapbot", "avatarUrl": "https://\u2026", "accent": "#ff6b4a" },
  "url": "https://yapboard.dev/bots/1049283746152839"
}

// not this bot's server:
{
  "ok": false,
  "reason": "wrong_server",
  "board": "bots",
  "detail": "This bot can only be bumped from its support server, or from a server its lister owns. \u2026"
}
// reason: cooldown | not_found | not_listed | wrong_server | banned`,
    notes: [
      'A bot may only be bumped from a server it belongs to: its support server, or a server its lister owns. Anywhere else answers `wrong_server`. One busy server bumping a shelf of other people\u2019s bots is the thing this prevents.',
      'Anyone in that server may do it - the gate is the server, not the person, the same way a server bump works. The cooldown still belongs to the listing.',
      'So send the real `serverId` the command came from. We can\u2019t prove it from outside Yapin\u2019, which is why misreporting it is a breach of the terms rather than a 4xx - and why the usage counters make a bot that bumps the same listing from everywhere easy to spot.',
      'If the lister\u2019s support server isn\u2019t set on the listing and isn\u2019t listed on YapBoard, there\u2019s nothing to vouch for it: they can set it on the listing, or bump from the site.',
    ],
  },
  {
    scope: 'bump',
    method: 'POST',
    path: '/clients/{client}/bump',
    title: 'Bump a client',
    blurb: 'A client listing, by id or slug, bumped from its support server. Same two-hour cooldown.',
    request: `{
  "user": { "id": "9876543210", "username": "ellie" },
  "serverId": "1234567890"           // where the command was typed - required
}`,
    response: `{
  "ok": true,
  "board": "clients",
  "bumpCount": 5,
  "nextAt": "2026-10-29T14:12:09.000Z",
  "client": { "id": "cl\u2026", "slug": "yapinplus", "name": "Yapin+", "iconUrl": "https://\u2026", "accent": "#ff6b4a" },
  "url": "https://yapboard.dev/clients/yapinplus"
}
// reason: cooldown | not_found | not_listed | wrong_server | banned`,
    notes: [
      '`{client}` is the id or the slug, whichever you have.',
      'Same home-server rule as bots. A client lives outside Yapin\u2019 entirely, so its support server is the only community there is to vouch for it.',
    ],
  },

  /* ---- reads ---- */
  {
    scope: 'listing',
    method: 'GET',
    path: '/servers/{serverId}',
    title: 'Read a server listing',
    blurb: 'What a `/yapboard`-style command needs: where the listing stands, and when it can bump again.',
    response: `{
  "listed": true,
  "name": "Yap Cafe",
  "summary": "Coffee and keyboards.",
  "status": "PUBLIC",
  "bumpCount": 38,
  "bumpedAt": "2026-10-28T12:12:09.000Z",
  "nextBumpAt": "2026-10-28T14:12:09.000Z",
  "memberCount": 412,
  "tags": ["chill", "gaming"],
  "badges": ["VERIFIED"],
  "url": "https://yapboard.dev/view/1234567890"
}

// not on YapBoard yet:
{ "listed": false, "addUrl": "https://yapboard.dev/add?server=1234567890" }`,
    notes: ['Hidden and removed listings answer `listed: true` with that status and no `url` - say so rather than claiming the server isn\u2019t listed.'],
  },
  {
    scope: 'bots',
    method: 'GET',
    path: '/bots/{botId}',
    title: 'Read a bot listing',
    blurb: 'A bot\u2019s listing, for a `/botinfo` command - including the support server people should be sent to.',
    response: `{
  "listed": true,
  "name": "Yapbot",
  "summary": "Moderation, with fewer menus.",
  "status": "PUBLIC",
  "serverCount": 1840,
  "prefix": "y!",
  "badges": ["VERIFIED"],
  "supportServer": { "id": "1234567890", "name": "Yapbot HQ" },
  "url": "https://yapboard.dev/bots/1049283746152839"
}`,
  },
];

/** Which group an endpoint belongs in, and the order the groups read in. */
const GROUPS = [
  { id: 'start', title: 'Getting started', match: (d: Doc) => d.path === '/me' },
  { id: 'search', title: 'Search', match: (d: Doc) => d.path.startsWith('/search') },
  { id: 'bumps', title: 'Bumps', match: (d: Doc) => d.path.endsWith('/bump') },
  { id: 'reads', title: 'Reads', match: (d: Doc) => true },
] as const;

/** A stable anchor per endpoint: POST /servers/{serverId}/bump -> post-servers-bump */
const anchor = (d: Doc) => `${d.method}-${d.path.split('?')[0]}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The curl that calls it, with the real base URL and a placeholder key. */
function curlFor(d: Doc, root: string) {
  const url = `${root}${d.path}`;
  if (d.method === 'GET') return `curl "${url}" \\\n  -H "Authorization: Bearer ybp_..."`;
  // The documented bodies carry aligned `// optional` notes, which curl shouldn't. Two spaces or more before
  // the slashes is what tells a comment from the `//` in a URL - `https://` has no space in front of it.
  const body = (d.request ?? '{}')
    .split('\n')
    .map((l) => l.replace(/\s{2,}\/\/.*$/, ''))
    .filter((l) => l.trim())
    .join('\n');
  return `curl -X POST "${url}" \\\n  -H "Authorization: Bearer ybp_..." \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
}

export default async function PlatformDocs() {
  const { member } = await requireMemberPage('/docs');
  const base = await platformBase();
  const allowed = readScopes(member.scopes);
  const root = apiRoot();

  // Each endpoint lands in the first group that claims it.
  const grouped = GROUPS.map((g) => ({ ...g, docs: DOCS.filter((d) => GROUPS.find((x) => x.match(d))?.id === g.id) })).filter((g) => g.docs.length);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_200px] xl:gap-10">
      <div className="max-w-3xl">
        <PageHead title="Commands & API" sub="Nine calls, one key, and the same rules YapBoard’s own bot plays by.">
          <Link href={base + '/requirements'} className="btn btn-secondary btn-sm">
            <ShieldCheck size={15} /> Requirements
          </Link>
        </PageHead>

        <section id="base" className="card scroll-mt-24 p-5">
          <h2 className="font-bold">Base URL</h2>
          <CopyField value={root} className="mt-3" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold">Authentication</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">Every request carries a key from one of your apps:</p>
              <CodeBlock className="mt-2" label="header" lang="http" code={'Authorization: Bearer ybp_...'} />
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
                Keys belong on your server, never in a client or a repo. A leaked key is revoked on the app’s page; mint the replacement first and
                there’s no downtime.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold">Limits and errors</h3>
              <ul className="mt-1.5 space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
                <li>
                  <b className="tabular-nums">{RATE.perMinute}</b> requests a minute per app, of which <b className="tabular-nums">{RATE.bumpPerMinute}</b> may be bumps — one budget across all
                  three boards. Over it: <code className="font-mono text-[12px]">429</code>.
                </li>
                <li>
                  <code className="font-mono text-[12px]">401</code> unknown or revoked key · <code className="font-mono text-[12px]">403</code> missing scope, paused app or suspended
                  account · <code className="font-mono text-[12px]">422</code> the body didn’t parse.
                </li>
                <li>
                  Errors are always <code className="font-mono text-[12px]">{'{ "error": "..." }'}</code>. A refusal that isn’t your fault — a cooldown, say — is a 200 with{' '}
                  <code className="font-mono text-[12px]">ok: false</code>.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="scopes" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-[20px] font-bold">Your scopes</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SCOPE_ORDER.map((s) => {
              const on = allowed.includes(s);
              return (
                <div key={s} className={clsx('card flex items-start gap-3 p-4', on ? 'border-ok/25' : 'opacity-70')}>
                  {on ? <Check size={15} className="mt-0.5 shrink-0 text-ok" /> : <Lock size={14} className="mt-0.5 shrink-0 text-ink-3" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {SCOPES[s].label} <code className="font-mono text-[11px] text-ink-3">{s}</code>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{SCOPES[s].blurb}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {grouped.map((g) => (
          <section key={g.id} id={g.id} className="mt-12 scroll-mt-24">
            <h2 className="font-display text-[20px] font-bold">{g.title}</h2>
            <div className="mt-4 space-y-6">
              {g.docs.map((d) => {
                const on = !d.scope || allowed.includes(d.scope);
                return (
                  <article key={d.path} id={anchor(d)} className="card scroll-mt-24 overflow-hidden">
                    <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
                      <EndpointLine method={d.method} path={d.path} base={root} />
                    </header>
                    <div className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{d.title}</h3>
                        {d.scope ? (
                          <span
                            className={clsx(
                              'inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] font-semibold',
                              on ? 'border-ok/30 bg-ok/10 text-ok' : 'border-line-strong bg-surface-2 text-ink-3',
                            )}
                          >
                            {on ? <Check size={10} /> : <Lock size={9} />} {d.scope}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-ink-3">no scope needed</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d.blurb}</p>

                      <CodeTabs
                        className="mt-4"
                        tabs={[
                          ...(d.request ? [{ label: 'Request', lang: 'json' as const, code: d.request }] : []),
                          { label: 'Response', lang: 'json' as const, code: d.response },
                          { label: 'curl', lang: 'bash' as const, code: curlFor(d, root) },
                        ]}
                      />

                      {d.notes && (
                        <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-ink-3">
                          {d.notes.map((n) => (
                            <li key={n} className="flex gap-2">
                              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent/70" />
                              <span>{n}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <p className="mt-12 text-sm text-ink-3">
          Building the commands these back?{' '}
          <Link href={base + '/requirements'} className="font-medium text-accent hover:underline">
            Requirements & code
          </Link>{' '}
          has the rules every integration follows, and tested JS and Python to start from.
        </p>
      </div>

      {/* Follows the page on a wide screen; at the top of the content on narrow ones it would just be noise. */}
      <nav aria-label="On this page" className="hidden xl:block">
        <div className="sticky top-8 border-l border-line pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">On this page</p>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            <li>
              <a href="#base" className="text-ink-3 transition-colors hover:text-ink">
                Base URL & auth
              </a>
            </li>
            <li>
              <a href="#scopes" className="text-ink-3 transition-colors hover:text-ink">
                Your scopes
              </a>
            </li>
            {grouped.map((g) => (
              <li key={g.id} className="pt-2">
                <a href={'#' + g.id} className="font-semibold text-ink-2 transition-colors hover:text-ink">
                  {g.title}
                </a>
                <ul className="mt-1 space-y-1">
                  {g.docs.map((d) => (
                    <li key={d.path}>
                      <a href={'#' + anchor(d)} className="flex gap-1.5 text-ink-3 transition-colors hover:text-ink">
                        <span className={clsx('font-mono text-[10px] leading-5', d.method === 'POST' ? 'text-accent' : 'text-ink-3')}>{d.method}</span>
                        <span className="truncate">{d.title.replace(/^(Search|Bump|Read) (a )?/, '')}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
