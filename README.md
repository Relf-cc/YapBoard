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

## Production checklist

- `prisma/schema.prisma`: switch the provider to `postgresql` and point `DATABASE_URL` at it
- `NEXT_PUBLIC_SITE_URL=https://yapboard.dev`, `PORTAL_URL=https://portal.yapboard.dev`, `COOKIE_DOMAIN=.yapboard.dev`
- Login with Yapin' redirect URI: `https://yapboard.dev/api/auth/callback`
- `STAFF_IDS` = your Yapin' user ID(s); grant others staff from the portal's Users page
- `SESSION_SECRET` and `INTERNAL_API_SECRET`: real random values. The `change-me` examples are refused
- Run `prisma db push` (or a migration) on deploy: logins are stored in a `Session` table
- Put the site behind a proxy that sets `X-Forwarded-For` / `X-Real-IP` (Vercel, Fly, nginx): rate limits use it
