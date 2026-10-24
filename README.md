# YapBoard

A server list for [Yapin'](https://www.yapin.gg), like Disboard.

- `Site/`: Next.js app: yapboard.dev (public site) and portal.yapboard.dev (staff portal)
- `Bot/`: the YapBoard bot (`/bump`, `/yapboard`) built on Yapin's `yapper.js` SDK (in progress)

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

## Production checklist

- `prisma/schema.prisma`: switch the provider to `postgresql` and point `DATABASE_URL` at it
- `NEXT_PUBLIC_SITE_URL=https://yapboard.dev`, `PORTAL_URL=https://portal.yapboard.dev`, `COOKIE_DOMAIN=.yapboard.dev`
- Login with Yapin' redirect URI: `https://yapboard.dev/api/auth/callback`
- `STAFF_IDS` = your Yapin' user ID(s); grant others staff from the portal's Users page
