<!-- Copyright (c) 2026 Christian Relf. All rights reserved. Proprietary and confidential. -->

# beta.yapboard.dev

The same app, on its own stack, over a **copy** of the real database, with every path that could reach
somebody cut.

Running it on real data is the whole point — an empty board tests nothing, and the new ranking in
particular cannot be judged against a handful of seeded servers. It is also the whole of the risk,
because every row in that copy names somebody who never asked to be in a test. Everything below
follows from those two facts.

---

## What is separate, and what would happen if it weren't

| | Beta | Why it has to differ |
| --- | --- | --- |
| Database | `beta-site-data` volume, `yapboard-beta.db` | A beta pointed at production is not a beta |
| Compose project | `yapboard-beta` | Without `-p`, Compose reuses production's containers *and volumes* |
| `SESSION_SECRET` | its own | A shared secret means a cookie from one site works on the other |
| `COOKIE_DOMAIN` | **empty** | `.yapboard.dev` is sent to the real site too — one login across both |
| Stripe | all six vars unset | `billingEnabled()` false → every billing route 503s, so beta cannot take money |
| Bot token | a second Yapin' app | The live bot would act in real servers against beta's database |
| Tunnel | its own | Stopping beta must not take a route off production's tunnel |

The `COOKIE_DOMAIN` one is the only mistake on that list that is **silent** — everything still appears
to work while beta and production quietly share a session, including a staff session minted on a copy.
So the site refuses to boot with one set (`checkBetaConfig` in [startup.ts](../Site/src/lib/startup.ts)),
rather than warning into a log nobody reads.

### Portal and platform are paths here, not subdomains

`PORTAL_URL=https://beta.yapboard.dev/portal`, not `portal.beta.yapboard.dev`. Cloudflare's universal
certificate covers `*.yapboard.dev` but not a second label, so the subdomain form would fail TLS unless
you buy an advanced certificate. [`proxy.ts`](../Site/src/proxy.ts) only redirects to a subdomain when
the configured URL actually *is* one, so the path form needs no code change and one tunnel hostname is
enough.

---

## What beta mode changes in the app

One variable, `NEXT_PUBLIC_BETA_VERSION`, is both "this is the beta" and "this is which beta". Empty is
production. It is baked into the bundle at build time, so changing it means rebuilding.

- **The badge and the bar.** `beta v1.10` beside the wordmark — in `Logo`, so the portal and platform get
  it too — and a bar on every page saying the board is a copy. The bar is not dismissible on purpose: an
  owner who finds a review of their server needs to know it isn't real *every* time, not once.
- **DMs go to staff only.** This is the sharp one. `BotDm` rows are addressed to real Yapin' accounts
  copied from production, and the beta bot has a valid token — so without this, a review written on a
  snapshot becomes a message to a stranger about a page they cannot see. Rows for non-staff are *held*,
  not dropped, so the portal still shows what would have been sent.
- **Broadcasts never leave.** Addressed to channel ids in real servers, and unlike a DM there is no
  "staff only" version worth testing. Staff can still write one and see it queued.

All three live in [beta.ts](../Site/src/lib/beta.ts).

---

## Setting it up

### 1. Things only you can do

None of these can be scripted — they are in dashboards, not in the repo.

1. **A second Yapin' bot application.** Its own token. Invite it to one server you own and nothing else.
2. **The beta callback on the Yapin' OAuth app**: add `https://beta.yapboard.dev/api/auth/callback` to
   the redirect URIs of the *existing* app. Same client id and secret, one more URI — that is what lets
   anyone with a Yapin' account log in to the beta.
3. **A Cloudflare tunnel of its own**, with `beta.yapboard.dev → http://caddy:80` as its only public
   hostname. Copy its token.

### 2. On the server

```bash
cd ~/YapBoard && git pull

cp .env.beta.example .env.beta
# Fill in: NEXT_PUBLIC_BETA_VERSION, the three items above, STAFF_IDS, and
#   SESSION_SECRET=$(openssl rand -base64 48)      # NOT production's
#   INTERNAL_API_SECRET=$(openssl rand -base64 32)
# Leave COOKIE_DOMAIN and every STRIPE_* out.
```

### 3. Take the copy

Run it *inside the production site container*, so the snapshot is taken by the process that already has
the database open:

```bash
docker compose exec site node scripts/beta-snapshot.mjs \
  --from file:/data/yapboard.db \
  --db   file:/data/yapboard-beta.db \
  --dry                                   # look first
```

Then drop `--dry`, and move the result onto the beta volume:

```bash
docker compose cp site:/data/yapboard-beta.db ./yapboard-beta.db
docker compose exec site rm /data/yapboard-beta.db      # don't leave it in production's volume

docker compose -p yapboard-beta --env-file .env.beta -f docker-compose.beta.yml up -d --build site
docker compose -p yapboard-beta --env-file .env.beta -f docker-compose.beta.yml cp \
  ./yapboard-beta.db site:/data/yapboard-beta.db
rm ./yapboard-beta.db
```

[`beta-snapshot.mjs`](../Site/scripts/beta-snapshot.mjs) does two things:

- **Copies** with `VACUUM INTO` rather than `cp`. Production is still running, and a plain copy of a live
  SQLite file can arrive subtly inconsistent — the worst failure available here, because it looks like it
  worked. (Through `node:sqlite`, because Prisma's SQLite driver refuses `VACUUM INTO` outright.)
- **Scrubs** what could act on the real world: sessions, platform API keys, queued DMs, broadcasts,
  Stripe customer links, billing consents and webhook history, announcements, and the `ranking` and
  `comments` settings.

It **keeps** servers, bots, clients, users, badges, tags, bumps, votes, uploads, reports, co-managers —
and the Pro subscriptions, deliberately, because a Pro listing that isn't Pro on beta makes the one perk
that touches ranking untestable.

It refuses to run against a path without `beta` in it, and refuses to overwrite an existing snapshot.
The second guard matters more than it looks: the beta database accumulates the beta-only reviews that are
the thing the beta exists to produce.

### 4. Bring it up

```bash
docker compose -p yapboard-beta --env-file .env.beta -f docker-compose.beta.yml up -d --build
docker compose -p yapboard-beta -f docker-compose.beta.yml logs -f site | head -40
```

Expect `[ranking] rebuilt N scores` and no `[beta]` lines. Any `[beta]` warning is worth reading; the
cookie one is fatal and the container will not start.

---

## Checking it is actually separate

Worth doing once, in this order, because each answers a different question.

```bash
# 1. Different databases
docker compose -p yapboard-beta -f docker-compose.beta.yml exec site sh -c 'echo $DATABASE_URL'
# -> file:/data/yapboard-beta.db

# 2. A review written on beta does not exist on production
#    Post one on beta, then on the real site, look at the same listing. Nothing.

# 3. Beta cannot take money
curl -s -o /dev/null -w '%{http_code}\n' https://beta.yapboard.dev/api/billing/checkout   # 401/503, never 200

# 4. Beta cannot message a stranger
#    Post a review on beta on somebody else's listing. The DM is queued and never sent:
docker compose -p yapboard-beta -f docker-compose.beta.yml exec site \
  node -e "const{PrismaClient}=require('@prisma/client');const d=new PrismaClient();d.botDm.findMany({select:{userId:true,status:true}}).then(r=>{console.log(r);return d.\$disconnect()})"
#    -> PENDING, for a non-staff id, forever
```

Verified locally before writing this: a DM queued for a non-staff user is handed out by a production
build of the same code against the same database, and withheld by a beta build. The interlock is what
stops it, not an accident of configuration.

---

## Turning it off, and starting over

```bash
# Stop, keep the data
docker compose -p yapboard-beta -f docker-compose.beta.yml down

# Stop and throw away every beta-only review
docker compose -p yapboard-beta -f docker-compose.beta.yml down -v
```

`down -v` on the beta project removes only `beta-*` volumes. Production's are named differently for
exactly this reason — but check the `-p` before pressing it.

To refresh the data from production later, delete the beta database first (the snapshot script will not
overwrite one) and remember that doing so discards every review written on beta.

---

## One thing to know about local builds

`next build` copies `Site/.env` into `.next/standalone/Site/`. `.dockerignore` excludes `.env`, so the
Docker image never contains it and the deployed stack is clean — but a `.next/standalone` directory
copied off a dev machine by hand would carry that file. Build on the server, or via Docker, and it never
comes up.
