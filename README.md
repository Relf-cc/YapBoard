# YapBoard

A server list for [Yapin'](https://www.yapin.gg), like Disboard.

> **Proprietary - all rights reserved.** Readable source, not open source. No copying, forking or self-hosting without written permission. See [Copyright and licence](#copyright-and-licence).

- `Site/`: Next.js app: yapboard.dev (public site), portal.yapboard.dev (staff portal), platform.yapboard.dev (developer platform) and api.yapboard.dev (API)
- `Bot/`: the YapBoard bot (`/bump`, `/yapboard`, `/info`, `/addbot`, `/invite`, `/help`) built on Yapin's `yapper.js` SDK (`YapinAssets/`)

Three boards: servers at `/servers`, the bots people run at `/bots`, and the clients people build at
`/clients`. All three share tags, badges, reports and the staff portal. Staff can also put a notice on the site
and send one message out through the bot - see below.

## Four things staff can do from the portal

**Announcements** (`/portal/announcements`, `Site/src/lib/announcements.ts`). A bar across the top of the site, or
a dialog shown once. Each one picks who sees it - everyone, logged-in people, or accounts younger than a set
number of hours - and can be scheduled with a start and an end. A banner can be made permanent (no close button).
Closing one is remembered per account, and in the browser for logged-out visitors; publishing an announcement
again clears that, so an edited notice reaches people who already dismissed the old one.

**Broadcasts** (`/portal/broadcasts`, `Site/src/lib/broadcasts.ts`). One message, posted by the bot in every
server that has used it - specifically the channel that server last typed `/bump` in, which the bot now reports
with each bump. Servers that have never bumped get nothing, and owners can opt out on their manage page. Staff
write a draft; only admins can send. Sending writes one row per server and the bot drains the queue by polling
`/api/internal/broadcasts`, so nothing is lost if the bot is restarting or offline. Failures (deleted channel,
bot kicked) are recorded per server and shown as progress in the portal.

**Bot listings** (`/portal/bots`, `Site/src/lib/bots.ts`). People list the bots they run at `/bots/add`, or run
`/addbot <bot id>` in its support server to get there with the IDs filled in (an @mention can’t work: on Yapin’ a
mention in a command picks which bot the command is sent to). The lister has to own or admin that
support server, and the bot has to be in it - both checked with Yapin' - which is as close to proving the bot is
theirs as Yapin's API allows; that link is also what puts a "support server" card on the bot's page.

Unlike servers, a bot listing doesn't go straight up. It waits as `PENDING` until staff approve or deny it from
`/portal/bots?status=PENDING`, where the Bots nav item carries the queue size. Approving sends it where the lister
asked (public, or unlisted if they ticked it). Denying stores the reason, which the lister sees on their manage
page; editing and saving a denied listing puts it back in the queue, so a denial asks for changes rather than
ending things. Either way the bot DMs them the outcome (`Site/src/lib/bot-dms.ts`, `Bot/cogs/dms.js`): the site
queues a row, the bot drains it and reports back, the same way broadcasts work.

Changing a listing's support server re-runs the ownership check and sends it back for review, since that server is
the whole claim the bot is yours. Bots bump on the same 2 hour cooldown, from the site rather than a command, and
take the same badges, tags and reports as servers.

**Client listings** (`/portal/clients`, `Site/src/lib/clients.ts`). A client is somebody's own build of Yapin',
shipped as its own executable. There is nothing on Yapin' to check one against - a server has an invite, a bot has
a support server, a client is a file on a stranger's release page - so two things stand in for that check.

Before a listing can be submitted, the lister has to accept the YapBoard client terms (`/clients/terms`) and
Yapin's terms, in a dialog that links both; the API refuses the request without it and the moment they agreed is
stored on the row. Then staff review it, from the same queue bots use. The portal row lays out the whole chain a
reviewer is actually judging - repo, release, and every download URL with the host it really goes to, flagged when
the files leave the repo - and the bot DMs the lister the decision either way, through the same queue bot listings
use (`Site/src/lib/bot-dms.ts`). Changing where the downloads come from sends a live listing back to the queue,
since staff approved a page pointing at one place.

Downloads normally come from a GitHub repo: `releases/latest` is read (`Site/src/lib/github.ts`), its assets are
sorted into platforms by filename - `.exe` and `.msi` to Windows, `.deb`, `.rpm` and `.AppImage` to Linux, `.dmg`
to macOS, `.apk` to Android, with checksums and signatures left out - and the release notes become the changelog
(`Site/src/lib/platforms.ts`). Releases re-read themselves half an hour after the last read, on the next page
view, once per client rather than once per visitor; a lister with a client hosted elsewhere keeps the links
themselves instead. Listers get the page itself to play with too: icon, banner, one of four header styles, accent
colour, up to six screenshots, and their own extra download links alongside the release's.

YapBoard never serves, mirrors or scans a client's files. `/get/<client>/<file>` counts the click and redirects,
and before that redirect a Trust & Safety dialog names the file, says which host it's really coming from, and says
plainly that a client runs with your account signed in. It's shown once per client per browsing session.

## Run the site locally

```sh
cd Site
cp .env.example .env      # then fill in SESSION_SECRET and INTERNAL_API_SECRET
npm install
npm run db:reset          # creates the SQLite DB and loads demo servers
npm run dev               # http://localhost:3000
```

With no `YAPIN_CLIENT_ID`/`YAPIN_CLIENT_SECRET`, `/login` shows a local dev login (tick "staff" to try the
portal). With no `YAPPER_BOT_TOKEN`, ownership checks are skipped and listings can be bumped from the dashboard.
Neither shortcut works in production.

The staff portal is at http://localhost:3000/portal in dev, and at the root of `portal.*` hosts in production. The
developer platform works the same way at `/platform` and `platform.*`. The API is at http://localhost:3000/api (or
the root of http://api.localhost:3000), and at the root of `api.*` hosts.

## The developer platform

platform.yapboard.dev (`Site/src/app/platform`, `Site/src/lib/platform.ts`) is an invite-only program for Yapin'
bot developers: a member can put YapBoard's commands inside their own bot - `/bump`, listing lookups, search -
instead of asking their users to add a second bot. It wears the staff portal's frame: same sidebar, cards and
tokens, its own four pages.

Invite-only on purpose. These calls act on other people's listings (a bump moves a real server up the board), so
the bot sending them has to be one we can name, reach and switch off. Three rows carry that:

- **Invite.** Staff write one on `/portal/platform` and hand the code over themselves - nothing is emailed or
  DMed, and an invite can be tied to one Yapin' account. Before any staff account exists,
  `node prisma/platform-invite.mjs --by <your user id>` writes the first one.
- **Member.** What redeeming a code makes. It carries the ceiling: which scopes they may hold, and how many apps
  they may register. Only admins change either.
- **App.** One bot, registered against its Yapin' bot ID, holding a subset of its member's scopes and as many
  keys as the developer needs. Keys are shown once and stored only as a hash; rotation is mint-then-revoke.

Four scopes, action-shaped rather than per board: `bump` covers `POST /servers/{id}/bump`, `/bots/{id}/bump`
and `/clients/{client}/bump`; `search` covers `GET /search/servers`, `/search/bots` and `/search/clients`;
`listing` and `bots` read one server or bot listing. The three searches answer with the same
`{ board, total, items }` shape, so one command can render whichever board it was pointed at.

Where a bump may come from matters as much as who sent it. A server is bumped by anyone in it, as on the site.
A bot or a client is bumped only **from a server it belongs to** — its support server, or a server its lister
owns (`serverIsHome` in `Site/src/lib/platform.ts`, which checks the listing, then our own `Server` rows, then
asks Yapin' as a fallback). Otherwise one busy server could push a shelf of other people's bots up the board,
which is backwards: a bump should say "the people here use this". Bot and client bumps therefore require the
`serverId` the command was typed in; nothing outside Yapin' can prove that, so the terms make misreporting it
a breach and the per-app counters make it visible. Members call the API on its own host,
`https://api.yapboard.dev/platform/v1/*` (`API_URL`), with `Authorization: Bearer ybp_…`
(`Site/src/app/api/platform/v1`), and
every request passes the same three gates - key live, app and member active, scope held - plus a per-app rate
limit. Calls are counted per app, per endpoint, per day, so both sides can see what a bot is doing: the developer
on their app page, staff on `/portal/platform`.

Nothing here is destructive. Staff suspend a member (every key of theirs is refused) or one app; a developer
pauses an app or retires it; keys are revoked, never deleted - a request arriving with an old one should read as
"revoked", not "never existed".

## Run the bot

Needs Node 20.12+ (22+ gets events over the gateway instead of long polling) and the site running.

```sh
cd Bot
cp .env.example .env      # YAPPER_BOT_TOKEN, YAPBOARD_URL, and the same INTERNAL_API_SECRET as Site/.env
npm start                 # or: npm run bot (from the root)
```

On start it logs its bot ID: put that in the site's `NEXT_PUBLIC_BOT_ID`, and the same token in the site's
`YAPPER_BOT_TOKEN` so ownership checks work. After a `/bump` the bot posts "Ready to bump" in that channel when
the 2 hour cooldown ends (kept in `Bot/data/` across restarts). Every 30 minutes, and on joins and leaves, it
sends member counts, names and icons to the site. It also asks the site once a minute whether staff have a
broadcast waiting, and posts it in the channel each server last bumped from (`Bot/cogs/broadcast.js`).

## Deploy with Docker

`docker-compose.yml` runs the site, the bot, [Caddy](https://caddyserver.com) and a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) on one machine.
The tunnel connects out to Cloudflare, so no ports are opened and the machine's IP stays hidden. Visitors go
Cloudflare (HTTPS) → `cloudflared` → Caddy (plain HTTP, Docker network only) → site.

1. Add `yapboard.dev` to Cloudflare (nameservers moved to Cloudflare).
2. Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared. Copy the token from the `docker run` command
   it shows into `TUNNEL_TOKEN` in `.env`.
3. On the tunnel, add four public hostnames, each type `HTTP` with URL `caddy:80`: `yapboard.dev`,
   `portal.yapboard.dev`, `platform.yapboard.dev` and `api.yapboard.dev`. Cloudflare creates the DNS records.
   Delete any old A/AAAA records for those names first.
4. Then:

```sh
cp .env.example .env      # fill it in (see the checklist below)
docker compose up -d --build
docker compose logs -f bot   # first run: copy the bot ID into NEXT_PUBLIC_BOT_ID, then up -d --build again
```

- The database is SQLite in the `site-data` volume (`/data/yapboard.db`). On every start the site runs
  `prisma db push`. A schema change that would drop data stops the start instead: fix it by hand, don't force it.
- Bump reminders are in the `bot-data` volume. Back up both volumes.
- `NEXT_PUBLIC_SITE_URL`, `PORTAL_URL`, `PLATFORM_URL`, `NEXT_PUBLIC_BOT_ID` and `NEXT_PUBLIC_BUG_REPORT_URL` are baked into the site at build time, so changing
  them needs `--build`. Everything else only needs `docker compose up -d`.
- All four hosts are the same Next app, told apart by Host (`src/proxy.ts`): `yapboard.dev` is the site,
  `portal.yapboard.dev` the staff portal, `platform.yapboard.dev` the developer platform, and `api.yapboard.dev`
  the API at its root (`/servers/123` there is `/api/servers/123` on the site). The site's own pages keep calling `/api` on their own origin. Login always happens
  on `yapboard.dev`: `api.yapboard.dev/auth/*` redirects there.
- The bot calls the site at `http://site:3000` (`YAPBOARD_API_URL`), and Caddy returns 404 for `/api/internal/*`
  (and `/internal/*` on the API host) from outside.
- Caddy sets `X-Real-IP` from `CF-Connecting-IP` (Cloudflare always overwrites it), so rate limits see the
  visitor, not the tunnel. Don't publish the site's or Caddy's port: a request that skips Cloudflare could pick
  its own IP.
- In Cloudflare, under SSL/TLS → Edge Certificates, turn on Always Use HTTPS. Leave Rocket Loader off: it rewrites
  scripts and breaks the Next.js bootstrap. The site sends its own HSTS header.
- Not using Cloudflare? Remove the `cloudflared` service, change the `Caddyfile` address from `:80` to
  `{$SITE_URL}, {$PORTAL_URL}` (Caddy then gets certificates itself), drop the `servers` block, publish ports 80
  and 443 on `caddy`, and pass `SITE_URL` / `PORTAL_URL` to it.

## Production checklist

- `NEXT_PUBLIC_SITE_URL=https://yapboard.dev`, `PORTAL_URL=https://portal.yapboard.dev`,
  `PLATFORM_URL=https://platform.yapboard.dev`, `API_URL=https://api.yapboard.dev`, `COOKIE_DOMAIN=.yapboard.dev`
- Login with Yapin' redirect URI: `https://yapboard.dev/api/auth/callback`
- `STAFF_IDS` = your Yapin' user ID(s); grant others staff from the portal's Users page
- `GITHUB_TOKEN` is optional: it only raises GitHub's rate limit for reading client releases (60 requests an hour
  per IP becomes 5,000). Read-only, no scopes. Without it, client releases still sync, just less often under load
- `SESSION_SECRET` and `INTERNAL_API_SECRET`: real random values. The `change-me` examples are refused
- Run `prisma db push` (or a migration) on deploy: logins are stored in a `Session` table (the Docker image does
  this on start)
- `TUNNEL_TOKEN` set, and the tunnel's public hostnames point at `caddy:80`
- Put the site behind a proxy that sets `X-Forwarded-For` / `X-Real-IP` (Caddy above, Vercel, Fly, nginx): rate
  limits use it
- Runs as one instance: rate limits are in memory. SQLite is fine at that size. To switch to Postgres, change the
  provider in `prisma/schema.prisma` and add `mode: 'insensitive'` to the `contains` searches (`src/lib/search.ts`,
  portal pages). Postgres matches case, SQLite doesn't, so search would quietly get worse otherwise

## Copyright and licence

Copyright © 2026 Christian Relf. All rights reserved.

YapBoard is **proprietary software, not open source**. The source is published here to be read, not reused.
You may read it and quote short excerpts with attribution. You may **not** copy, fork, mirror, host, deploy,
modify, rebrand or redistribute it, or run your own instance of YapBoard, without written permission - see
[LICENSE](LICENSE) for the full terms. The YapBoard name, logo and visual design are reserved and are not
licensed under any circumstances.

Third-party dependencies stay under their own licences, held by their own authors.

Licence enquiries: support@yapboard.dev
