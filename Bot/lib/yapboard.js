// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
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
export const bump = ({ serverId, user, memberCount, channelId }) =>
  call('POST', '/bump', {
    serverId: String(serverId),
    userId: String(user.id),
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    memberCount,
    // Where staff's global messages go back to (Site/src/lib/broadcasts.ts).
    channelId: channelId === undefined ? undefined : String(channelId),
  });

/** { listed: false, addUrl } or { listed: true, name, status, bumpCount, bumpedAt, nextBumpAt, memberCount, views, joins, tags, url, manageUrl } */
export const listing = (serverId) => call('GET', `/servers/${id(serverId)}`);

/** Keep name, icon and member count fresh. Ignored for servers that aren't listed. */
export const syncServer = (serverId, data) => call('PATCH', `/servers/${id(serverId)}`, data);

/**
 * The next batch of review-decision DMs to send, or { work: false }.
 * { work: true, dms: [{ id, userId, title, body, linkUrl, linkLabel }] }
 */
export const nextBotDms = () => call('GET', '/bot-dms');

/** What happened to a batch of DMs: [{ id, ok, error }]. Anything left out is handed back out later. */
export const reportBotDms = (results) => call('POST', '/bot-dms', { results });

/**
 * The next batch of a global message to post, or { work: false }.
 * { work: true, broadcastId, title, body, linkUrl, linkLabel, deliveries: [{ id, serverId, channelId }] }
 */
export const nextBroadcast = () => call('GET', '/broadcasts');

/** What happened to a batch: [{ id, ok, error }]. Anything left out is handed back out later. */
export const reportBroadcast = (broadcastId, results) => call('POST', '/broadcasts', { broadcastId, results });
