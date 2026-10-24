# YapBoard

A server list for [Yapin'](https://www.yapin.gg), like Disboard.

- `Site/`: Next.js app: yapboard.dev (public site) and portal.yapboard.dev (staff portal)
- `Bot/`: the YapBoard bot (`/bump`, `/yapboard`, `/invite`, `/help`) built on Yapin's `yapper.js` SDK (`YapinAssets/`)

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

The staff portal is at http://localhost:3000/portal in dev, and at the root of `portal.*` hosts in production.

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
sends member counts, names and icons to the site.

## Deploy with Docker

`docker-compose.yml` runs the site, the bot, [Caddy](https://caddyserver.com) and a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) on one machine.
The tunnel connects out to Cloudflare, so no ports are opened and the machine's IP stays hidden. Visitors go
Cloudflare (HTTPS) → `cloudflared` → Caddy (plain HTTP, Docker network only) → site.

1. Add `yapboard.dev` to Cloudflare (nameservers moved to Cloudflare).
2. Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared. Copy the token from the `docker run` command
   it shows into `TUNNEL_TOKEN` in `.env`.
3. On the tunnel, add two public hostnames, both type `HTTP` with URL `caddy:80`: `yapboard.dev` and
   `portal.yapboard.dev`. Cloudflare creates the DNS records. Delete any old A/AAAA records for those names first.
4. Then:

```sh
cp .env.example .env      # fill it in (see the checklist below)
docker compose up -d --build
docker compose logs -f bot   # first run: copy the bot ID into NEXT_PUBLIC_BOT_ID, then up -d --build again
```

- The database is SQLite in the `site-data` volume (`/data/yapboard.db`). On every start the site runs
  `prisma db push`. A schema change that would drop data stops the start instead: fix it by hand, don't force it.
- Bump reminders are in the `bot-data` volume. Back up both volumes.
- `NEXT_PUBLIC_SITE_URL`, `PORTAL_URL` and `NEXT_PUBLIC_BOT_ID` are baked into the site at build time, so changing
  them needs `--build`. Everything else only needs `docker compose up -d`.
- The bot calls the site at `http://site:3000` (`YAPBOARD_API_URL`), and Caddy returns 404 for `/api/internal/*` from
  outside.
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
