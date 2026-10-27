// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import * as yapboard from '../lib/yapboard.js';
import { card, links, siteLink } from '../lib/ui.js';

/**
 * Review decisions, delivered as DMs (Site/src/lib/bot-dms.ts).
 *
 * Same shape as the broadcast cog: the site never pushes at us, we ask. Each DM is reported on its own merits,
 * so one person with DMs closed can't hold up anyone else's. A batch we never report on is handed back out
 * after a few minutes, so a crash mid-send costs at most a repeat.
 *
 * A DM is a nudge, not the record: the listing's own page and the dashboard already say where it stands, so one
 * that can't be delivered (DMs off, account gone) is recorded as failed and left alone.
 */

/** Nothing waiting: ask again in a minute. */
const IDLE = 60_000;
/** Something was waiting: come back for the next batch shortly. */
const BUSY = 3_000;
/** Between DMs, so a run of decisions doesn't arrive as one burst. */
const GAP = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let timer = null;
let stopped = false;

export default function setup(bot) {
  /** One batch. Returns true when there may be more waiting. */
  const runOnce = async () => {
    let job;
    try {
      job = await yapboard.nextBotDms();
    } catch (e) {
      // The site being down is normal during a deploy; try again on the slow tick.
      console.error('[yapboard] dms: could not reach the site:', e.message);
      return false;
    }
    if (!job?.work || !job.dms?.length) return false;

    const results = [];
    for (const dm of job.dms) {
      if (stopped) break;
      const { components, extra } = links([dm.linkLabel || 'Open YapBoard', dm.linkUrl || siteLink()]);
      const embed = card({ title: dm.title, description: dm.body + extra, time: true });
      try {
        await bot.dmSend(dm.userId, '', { embeds: [embed], components });
        results.push({ id: dm.id, ok: true });
      } catch (e) {
        // DMs closed, not sharing a server, account deleted: recorded and moved past.
        results.push({ id: dm.id, ok: false, error: String(e.message || e).slice(0, 300) });
      }
      await sleep(GAP);
    }

    if (results.length) {
      try {
        await yapboard.reportBotDms(results);
      } catch (e) {
        // Unreported rows are handed out again later, so the worst case is a repeat, not a silent drop.
        console.error('[yapboard] dms: could not report a batch:', e.message);
      }
      const failed = results.filter((r) => !r.ok).length;
      console.log(`[yapboard] dms: sent ${results.length - failed} of ${results.length}${failed ? ` (${failed} couldn't be delivered)` : ''}`);
    }
    return !stopped && results.length === job.dms.length;
  };

  const tick = async () => {
    let more = true;
    while (more && !stopped) more = await runOnce();
    if (!stopped) timer = setTimeout(() => void tick(), IDLE);
  };

  const begin = () => {
    stopped = false;
    clearTimeout(timer);
    timer = setTimeout(() => void tick(), BUSY);
  };
  if (bot.me) begin();
  else bot.on('ready', begin);
}

export function teardown() {
  stopped = true;
  clearTimeout(timer);
}
