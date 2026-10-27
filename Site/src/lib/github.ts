// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { env } from './env';

/**
 * Reading a client's latest release from GitHub.
 *
 * Read-only and unauthenticated by default: a listing is a public repo, so nothing here needs a token. Setting
 * GITHUB_TOKEN only buys a bigger rate limit (60 requests an hour per IP becomes 5,000), which matters once a
 * few dozen clients are listed and syncing. Nothing is ever written back to GitHub.
 *
 * "Latest" means what GitHub means by it: /releases/latest, the newest release that isn't a draft or a
 * prerelease. Plenty of clients only ever ship prereleases, so a repo with none falls back to the newest
 * release of any kind rather than looking empty.
 */

const API = 'https://api.github.com';

/** Owner and repo as GitHub allows them: letters, digits, dots, dashes and underscores. */
const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9_-])?$/;

/**
 * "owner/repo" from whatever someone pastes: the browser URL, the clone URL, a releases page, or the bare
 * "owner/repo". Returns null when it isn't a GitHub repo, so the form can say so.
 */
export function parseRepo(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  let path = raw;
  const m = raw.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i);
  if (m) path = m[1];
  else if (/^git@github\.com:/i.test(raw)) path = raw.replace(/^git@github\.com:/i, '');
  else if (/^https?:\/\//i.test(raw)) return null; // some other host

  const parts = path.replace(/\.git$/i, '').split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  if (!REPO_RE.test(owner) || !REPO_RE.test(repo)) return null;
  return `${owner}/${repo}`;
}

export const repoUrl = (repo: string) => `https://github.com/${repo}`;

export type ReleaseAsset = { name: string; url: string; size: number | null };

export type Release = {
  tag: string;
  /** The release's own title, when the author gave it one that isn't just the tag again. */
  name: string | null;
  body: string;
  url: string;
  publishedAt: Date | null;
  prerelease: boolean;
  assets: ReleaseAsset[];
};

export type ReleaseResult = { ok: true; release: Release } | { ok: false; reason: ReleaseFailure };

export type ReleaseFailure = 'bad_repo' | 'not_found' | 'no_release' | 'rate_limited' | 'unavailable';

export const RELEASE_ERRORS: Record<ReleaseFailure, string> = {
  bad_repo: 'That doesn’t look like a GitHub repository.',
  not_found: 'GitHub doesn’t have that repository, or it’s private. Public repositories only.',
  no_release: 'That repository has no releases yet. Publish one, then sync.',
  rate_limited: 'GitHub is rate-limiting us right now. Try again in a few minutes.',
  unavailable: 'Couldn’t reach GitHub. Try again in a minute.',
};

async function get(path: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(API + path, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'yapboard-site/1',
      ...(env.githubToken ? { authorization: `Bearer ${env.githubToken}` } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

type RawRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  created_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
};

/** Release notes can run to thousands of lines; the page shows the latest changelog, not a book. */
const MAX_BODY = 8000;

function toRelease(raw: RawRelease, repo: string): Release {
  const tag = String(raw.tag_name ?? '').slice(0, 80);
  const name = typeof raw.name === 'string' && raw.name.trim() && raw.name.trim() !== tag ? raw.name.trim().slice(0, 140) : null;
  const when = typeof raw.published_at === 'string' ? raw.published_at : typeof raw.created_at === 'string' ? raw.created_at : null;
  const published = when ? new Date(when) : null;
  const assets = Array.isArray(raw.assets) ? raw.assets : [];
  return {
    tag,
    name,
    body: typeof raw.body === 'string' ? raw.body.trim().slice(0, MAX_BODY) : '',
    url: typeof raw.html_url === 'string' ? raw.html_url : `${repoUrl(repo)}/releases/tag/${encodeURIComponent(tag)}`,
    publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
    prerelease: raw.prerelease === true,
    assets: assets
      .map((a) => a as Record<string, unknown>)
      .filter((a) => typeof a?.name === 'string' && typeof a?.browser_download_url === 'string')
      .map((a) => ({
        name: String(a.name).slice(0, 200),
        url: String(a.browser_download_url),
        size: Number.isSafeInteger(a.size) && (a.size as number) >= 0 ? (a.size as number) : null,
      }))
      // Only ever hand out https links: these end up as hrefs on the client's page.
      .filter((a) => /^https:\/\/\S+$/.test(a.url)),
  };
}

/**
 * The release a client's downloads come from. Always re-derived from the repo, never from anything the lister
 * stored, so a listing can't point its download buttons at a file GitHub isn't serving.
 */
export async function fetchLatestRelease(repoInput: string): Promise<ReleaseResult> {
  const repo = parseRepo(repoInput);
  if (!repo) return { ok: false, reason: 'bad_repo' };

  try {
    const latest = await get(`/repos/${repo}/releases/latest`);
    if (latest.status === 200 && latest.data) return { ok: true, release: toRelease(latest.data as RawRelease, repo) };
    if (latest.status === 403 || latest.status === 429) return { ok: false, reason: 'rate_limited' };

    if (latest.status === 404) {
      // 404 here is either "no repo" or "no full release yet". Ask for the list to tell those apart, which also
      // picks up repos that only ever publish prereleases — common for a client in beta.
      const list = await get(`/repos/${repo}/releases?per_page=10`);
      if (list.status === 404) return { ok: false, reason: 'not_found' };
      if (list.status === 403 || list.status === 429) return { ok: false, reason: 'rate_limited' };
      if (list.status !== 200 || !Array.isArray(list.data)) return { ok: false, reason: 'unavailable' };
      const usable = (list.data as RawRelease[]).find((r) => r?.draft !== true);
      if (!usable) return { ok: false, reason: 'no_release' };
      return { ok: true, release: toRelease(usable, repo) };
    }
    return { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
