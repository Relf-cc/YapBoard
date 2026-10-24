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

  const countChanged = (ev) => {
    const serverId = String(ev.server_id);
    const count = memberCountOf(ev);
    if (count === undefined || !ev.server_id) return;
    const had = pending.get(serverId);
    pending.set(serverId, { count, timer: had?.timer ?? setTimeout(() => flush(serverId), SETTLE) });
  };

  const flush = (serverId) => {
    const p = pending.get(serverId);
    pending.delete(serverId);
    if (p) yapboard.syncServer(serverId, { memberCount: p.count }).catch((e) => console.error('[yapboard] sync:', e.message));
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
