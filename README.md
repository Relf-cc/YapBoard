# YapBoard

A server list for [Yapin'](https://www.yapin.gg), like Disboard.

> **Proprietary — all rights reserved.** Readable source, not open source. No copying, forking or self-hosting without written permission. See [Copyright and licence](#copyright-and-licence).

- `Site/`: Next.js app: yapboard.dev (public site), portal.yapboard.dev (staff portal) and api.yapboard.dev (API)
- `Bot/`: the YapBoard bot (`/bump`, `/yapboard`, `/info`, `/addbot`, `/invite`, `/help`) built on Yapin's `yapper.js` SDK (`YapinAssets/`)

Two boards: servers at `/servers`, and the bots people run at `/bots`. Both share tags, badges, reports and the
staff portal. Staff can also put a notice on the site and send one message out through the bot — see below.

## Three things staff can do from the portal

**Announcements** (`/portal/announcements`, `Site/src/lib/announcements.ts`). A bar across the top of the site, or
a dialog shown once. Each one picks who sees it — everyone, logged-in people, or accounts younger than a set
number of hours — and can be scheduled with a start and an end. A banner can be made permanent (no close button).
Closing one is remembered per account, and in the browser for logged-out visitors; publishing an announcement
again clears that, so an edited notice reaches people who already dismissed the old one.

**Broadcasts** (`/portal/broadcasts`, `Site/src/lib/broadcasts.ts`). One message, posted by the bot in every
server that has used it — specifically the channel that server last typed `/bump` in, which the bot now reports
with each bump. Servers that have never bumped get nothing, and owners can opt out on their manage page. Staff
write a draft; only admins can send. Sending writes one row per server and the bot drains the queue by polling
`/api/internal/broadcasts`, so nothing is lost if the bot is restarting or offline. Failures (deleted channel,
bot kicked) are recorded per server and shown as progress in the portal.

**Bot listings** (`/portal/bots`, `Site/src/lib/bots.ts`). People list the bots they run at `/bots/add`. The lister
has to own or admin the bot's support server, which is checked with Yapin' the same way server listings are — that
link is also what puts a "support server" card on the bot's page. Bots bump on the same 2 hour cooldown, from the
site rather than a command, and take the same badges, tags and reports as servers.

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
API is at http://localhost:3000/api (or the root of http://api.localhost:3000), and at the root of `api.*` hosts.

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
3. On the tunnel, add three public hostnames, each type `HTTP` with URL `caddy:80`: `yapboard.dev`,
   `portal.yapboard.dev` and `api.yapboard.dev`. Cloudflare creates the DNS records. Delete any old A/AAAA records
   for those names first.
4. Then:

```sh
cp .env.example .env      # fill it in (see the checklist below)
docker compose up -d --build
docker compose logs -f bot   # first run: copy the bot ID into NEXT_PUBLIC_BOT_ID, then up -d --build again
```

- The database is SQLite in the `site-data` volume (`/data/yapboard.db`). On every start the site runs
  `prisma db push`. A schema change that would drop data stops the start instead: fix it by hand, don't force it.
- Bump reminders are in the `bot-data` volume. Back up both volumes.
- `NEXT_PUBLIC_SITE_URL`, `PORTAL_URL`, `NEXT_PUBLIC_BOT_ID` and `NEXT_PUBLIC_BUG_REPORT_URL` are baked into the site at build time, so changing
  them needs `--build`. Everything else only needs `docker compose up -d`.
- All three hosts are the same Next app, told apart by Host (`src/proxy.ts`): `yapboard.dev` is the site,
  `portal.yapboard.dev` the staff portal, and `api.yapboard.dev` the API at its root (`/servers/123` there is
  `/api/servers/123` on the site). The site's own pages keep calling `/api` on their own origin. Login always happens
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

- `NEXT_PUBLIC_SITE_URL=https://yapboard.dev`, `PORTAL_URL=https://portal.yapboard.dev`, `COOKIE_DOMAIN=.yapboard.dev`
- Login with Yapin' redirect URI: `https://yapboard.dev/api/auth/callback`
- `STAFF_IDS` = your Yapin' user ID(s); grant others staff from the portal's Users page
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
modify, rebrand or redistribute it, or run your own instance of YapBoard, without written permission — see
[LICENSE](LICENSE) for the full terms. The YapBoard name, logo and visual design are reserved and are not
licensed under any circumstances.

Third-party dependencies stay under their own licences, held by their own authors.

Licence enquiries: support@yapboard.dev
