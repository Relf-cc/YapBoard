# Failover Worker

Keeps `yapboard.dev` answering with the maintenance page when the home server is unreachable, instead of
Cloudflare's own "Error 1033 - Argo Tunnel error" page.

## How the request flows

```text
visitor → yapboard.dev ──▶ [ yapboard-failover Worker ]
                                      │
                   origin up          │          origin down
                          ┌───────────┴───────────┐
                          ▼                       ▼
            origin.yapboard.dev        yapboard-maintenance.<acct>.workers.dev
                  (tunnel)                    served as 503
                      │
                  cloudflared → caddy → site:3000
```

`origin.yapboard.dev` is a second public hostname on the **same** tunnel, pointing at the same
`http://caddy:80`. It exists so the Worker has a way to reach the origin that does not pass back through
itself - fetching `yapboard.dev` from inside the Worker would loop.

## The Host header, and why it matters here

`Caddyfile` routes on `Host`, and the Next app picks site / portal / API from `X-Forwarded-Host`. A naive
second hostname would arrive as `Host: origin.yapboard.dev`, which the app does not recognise.

The tunnel's ingress rule for `origin.yapboard.dev` therefore sets `httpHostHeader: yapboard.dev`, so
cloudflared rewrites the Host before it reaches Caddy. Nothing in `Caddyfile`, the app, or the compose file
needs to change.

## What counts as "down"

Only the statuses that mean the origin itself is missing: `502 503 504 521-527 530`, plus any fetch that
throws or exceeds 10s.

A plain `500` from the app passes **through** on purpose. A maintenance page that appears whenever the app
throws would hide real bugs and make them much harder to notice.

Requests under `/api/`, or any request that asks for `application/json`, get a JSON 503 rather than the HTML
page, so programmatic clients get something they can parse.

## What is deployed

| Thing | Name | Notes |
| --- | --- | --- |
| Failover Worker | `yapboard-failover` | route `yapboard.dev/*` |
| Maintenance page | `yapboard-maintenance` | served from `StaticSite/` |
| Tunnel hostname | `origin.yapboard.dev` | same tunnel, `httpHostHeader: yapboard.dev` |

The maintenance page could not be called `yapboard-fallback`: an empty Worker of that name already exists in
the account, and current Pages deploys through the Workers platform, so the names collide. It is also a
`workers.dev` URL rather than `pages.dev`, because Pages now deploys as a Worker with static assets.

## Deploying

```sh
# the Worker
npx wrangler deploy --config Failover/wrangler.toml

# the maintenance page (root wrangler.jsonc points at StaticSite/)
npx wrangler deploy
```

This uploads the Worker but does **not** put it in front of the domain - the route is attached separately
and deliberately (see `wrangler.toml`).

## Rolling back

The route is the only thing that affects live traffic, and removing it is instant and total:

Dashboard → Workers & Pages → `yapboard-failover` → Settings → Domains & Routes → delete `yapboard.dev/*`.

Traffic goes straight back to the tunnel the moment it is gone. The Worker, the Pages project and the
`origin.yapboard.dev` hostname can all be left in place; none of them touch traffic on their own.
