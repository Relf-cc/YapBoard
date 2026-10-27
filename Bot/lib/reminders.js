// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.js';

const FILE = join(config.dataDir, 'reminders.json');

/**
 * "Bump is ready again" reminders, one per server, kept in data/reminders.json so a restart doesn't lose them.
 * `due(serverId, channelId)` runs when one fires; return a later Date/ISO string to push it back instead.
 */
export function createReminders(due) {
  /** serverId → { channelId, at (ms) } */
  const all = new Map();
  const timers = new Map();
  let saving = Promise.resolve();

  const save = () => {
    saving = saving.then(async () => {
      await mkdir(config.dataDir, { recursive: true });
      const tmp = `${FILE}.tmp`;
      await writeFile(tmp, JSON.stringify(Object.fromEntries(all), null, 2));
      await rename(tmp, FILE);
    }).catch((e) => console.error('[yapboard] could not save reminders:', e.message));
    return saving;
  };

  const arm = (serverId) => {
    clearTimeout(timers.get(serverId));
    const r = all.get(serverId);
    if (!r) return;
    // Fire a few seconds late so the site's cooldown has surely passed.
    timers.set(serverId, setTimeout(() => void fire(serverId), Math.max(0, r.at - Date.now()) + 5_000));
  };

  const fire = async (serverId) => {
    const r = all.get(serverId);
    timers.delete(serverId);
    if (!r) return;
    let later = null;
    try {
      later = await due(serverId, r.channelId);
    } catch (e) {
      console.error(`[yapboard] reminder for ${serverId} failed:`, e.message);
    }
    const at = later ? new Date(later).getTime() : NaN;
    if (at > Date.now()) {
      all.set(serverId, { ...r, at });
      arm(serverId);
    } else {
      all.delete(serverId);
    }
    await save();
  };

  return {
    async load() {
      let raw = {};
      try {
        raw = JSON.parse(await readFile(FILE, 'utf8'));
      } catch (e) {
        if (e.code !== 'ENOENT') console.error('[yapboard] reminders.json is unreadable, starting fresh:', e.message);
      }
      for (const [serverId, r] of Object.entries(raw)) {
        if (r && typeof r.channelId === 'string' && Number.isFinite(r.at)) {
          all.set(serverId, { channelId: r.channelId, at: r.at });
          arm(serverId);
        }
      }
      return all.size;
    },
    set(serverId, channelId, at) {
      all.set(String(serverId), { channelId: String(channelId), at: new Date(at).getTime() });
      arm(String(serverId));
      return save();
    },
    stop() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}
