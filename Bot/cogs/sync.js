// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import * as yapboard from '../lib/yapboard.js';
import { fileUrl, memberCountOf } from '../lib/ui.js';

const EVERY = 30 * 60_000;
/** Joins and leaves come in bursts (raids, purges): send one update per server per minute at most. */
const SETTLE = 60_000;

let timer = null;
const pending = new Map();

/** Keeps listings' member counts, names and icons in step with Yapin'. Unlisted servers are skipped by the site. */
export default function setup(bot) {
  const syncAll = async () => {
    let servers;
    try {
      servers = await bot.servers();
    } catch (e) {
      return console.error('[yapboard] sync: could not list servers:', e.message);
    }
    let failed = 0;
    // One at a time: there's no rush, and it keeps us well inside both rate limits.
    for (const s of servers || []) {
      const data = { memberCount: memberCountOf(s), name: s.name ? String(s.name).slice(0, 100) : undefined };
      const icon = fileUrl('icons', s.icon_path ?? s.icon);
      if (icon) data.iconUrl = icon;
      if (Object.values(data).every((v) => v === undefined)) continue;
      try {
        await yapboard.syncServer(s.id, data);
      } catch {
        failed++;
      }
    }
    if (failed) console.error(`[yapboard] sync: ${failed} of ${servers.length} servers failed (is the site up?)`);
  };

  // Join and leave events only say which server (no count), so once things settle, ask Yapin' for the count.
  const countChanged = (ev) => {
    if (!ev.server_id) return;
    const serverId = String(ev.server_id);
    if (!pending.has(serverId)) pending.set(serverId, { timer: setTimeout(() => void flush(serverId), SETTLE) });
  };

  const flush = async (serverId) => {
    pending.delete(serverId);
    try {
      const memberCount = memberCountOf(await bot.server(serverId));
      if (memberCount !== undefined) await yapboard.syncServer(serverId, { memberCount });
    } catch (e) {
      console.error('[yapboard] sync:', e.message);
    }
  };

  bot.on('member_join', countChanged);
  bot.on('member_leave', countChanged);

  const begin = () => {
    clearInterval(timer);
    timer = setInterval(() => void syncAll(), EVERY);
    void syncAll();
  };
  if (bot.me) begin();
  else bot.on('ready', begin);
}

export function teardown() {
  clearInterval(timer);
  for (const p of pending.values()) clearTimeout(p.timer);
  pending.clear();
}
