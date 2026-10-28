# StaticSite - maintenance page

A single static page to put up while YapBoard is down. No build step, no dependencies.

```text
index.html    the page, served at /
404.html      identical copy, served for every other path
_headers      no-store caching + noindex
```

There is deliberately no `_redirects` file. Pages serves `404.html` for anything that does not match an
asset, so the two copies between them already cover every URL. A catch-all `/* /index.html 200` rule looks
tempting but Pages rejects it - it strips `.html` and `/index` from request paths, so the rule re-matches its
own target and the upload fails with *"Infinite loop detected in this rule"*.

## Deploy to Cloudflare Pages

**Dashboard (quickest):** Workers & Pages → Create → Pages → *Upload assets* → drag this folder in. Leave the
build command empty.

**Wrangler:**

```sh
npx wrangler pages deploy StaticSite --project-name=yapboard-maintenance
```

**Git-connected project:** set the build output directory to `StaticSite` and leave the build command empty.

To point the real domain at it, add the custom domain under the project's *Custom domains* tab (this takes the
domain off the live site, so only do it once maintenance has started).

## Editing the wording

Three lines near the bottom of `index.html`, under the `===== wording =====` comment: the `503 · Maintenance`
eyebrow, the `<h1>`, and the paragraph under it. The second button in `.actions` points at
`https://yapin.gg/invite/yapboardapp`.

**Copy any change across to `404.html`** - the two files are meant to be byte-identical:

```sh
cp StaticSite/index.html StaticSite/404.html
```

The page reloads itself every 60 seconds (the countdown and the `left = 60` in the script at the bottom).

## Notes

- Colors and fonts are the app's own tokens, copied from `Site/src/app/globals.css`, so the page matches the
  live site. The character and the logo are inline SVG, so there are no image files to lose.
- Status codes: `/` returns `200`, every other path returns `404` (from `404.html`). Pages cannot return a real
  `503` for a static asset. The page is `noindex` either way, but if a long outage needs the correct signal,
  front it with a Worker that returns `503` with this HTML as the body.
