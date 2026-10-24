import { config } from './config.js';

/** Calls the site's /api/internal/* routes with the shared secret. Throws on network errors and non-2xx. */
async function call(method, path, body) {
  const res = await fetch(`${config.apiUrl}/api/internal${path}`, {
    method,
    headers: { authorization: `Bearer ${config.internalSecret}`, 'content-type': 'application/json', 'user-agent': 'yapboard-bot/1' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`YapBoard ${method} ${path} failed (${res.status}${out.error ? `: ${out.error}` : ''})`);
    err.status = res.status;
    throw err;
  }
  return out;
}

const id = (s) => encodeURIComponent(String(s));

/**
 * Bump a server. Resolves to the site's answer:
 *   { ok: true, bumpCount, nextAt, name, url, addUrl }
 *   { ok: false, reason: 'cooldown' | 'not_found' | 'not_listed' | 'banned', nextAt?, name, url, addUrl }
 */
export const bump = ({ serverId, user, memberCount }) =>
  call('POST', '/bump', {
    serverId: String(serverId),
    userId: String(user.id),
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    memberCount,
  });

/** { listed: false, addUrl } or { listed: true, name, status, bumpCount, bumpedAt, nextBumpAt, memberCount, views, joins, tags, url, manageUrl } */
export const listing = (serverId) => call('GET', `/servers/${id(serverId)}`);

/** Keep name, icon and member count fresh. Ignored for servers that aren't listed. */
export const syncServer = (serverId, data) => call('PATCH', `/servers/${id(serverId)}`, data);
