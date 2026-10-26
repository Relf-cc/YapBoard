import * as yapboard from '../lib/yapboard.js';
import { card, links, siteLink } from '../lib/ui.js';

/**
 * Global messages from YapBoard staff (Site/src/lib/broadcasts.ts).
 *
 * The site never pushes at us: we ask. Every POLL we take a batch of deliveries, post each one in the channel
 * that server last used `/bump` in, and tell the site how each went. A batch we never report on is handed back
 * out after a few minutes, so a crash mid-send costs at most a few duplicate posts — far better than silently
 * dropping a message staff think went out.
 *
 * While a broadcast is draining we poll fast; the rest of the time, slowly.
 */

/** Nothing to do: ask again in a minute. */
const IDLE = 60_000;
/** Mid-broadcast: come straight back for the next batch. */
const BUSY = 3_000;
/** Between messages, so a few hundred servers don't arrive as one burst. */
const GAP = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let timer = null;
let stopped = false;

export default function setup(bot) {
  /**
   * One batch. Returns true when there may be more waiting.
   * Each delivery is reported on its own merits: one server with a deleted channel can't stop the rest.
   */
  const runOnce = async () => {
    let job;
    try {
      job = await yapboard.nextBroadcast();
    } catch (e) {
      // The site being down is normal during a deploy; try again on the slow tick.
      console.error('[yapboard] broadcast: could not reach the site:', e.message);
      return false;
    }
    if (!job?.work) return false;

    const { components, extra } = links([job.linkLabel || 'Open YapBoard', job.linkUrl || siteLink()]);
    const embed = card({ title: job.title, description: job.body + extra, time: true });
    const results = [];

    for (const d of job.deliveries) {
      if (stopped) break;
      try {
        await bot.send(d.channelId, '', { embeds: [embed], components });
        results.push({ id: d.id, ok: true });
      } catch (e) {
        // Channel deleted, bot kicked, no permission: the site records it and moves on.
        results.push({ id: d.id, ok: false, error: String(e.message || e).slice(0, 300) });
      }
      await sleep(GAP);
    }

    if (results.length) {
      try {
        await yapboard.reportBroadcast(job.broadcastId, results);
      } catch (e) {
        // Unreported deliveries are handed out again later, so the worst case is a repeat, not a silent drop.
        console.error('[yapboard] broadcast: could not report a batch:', e.message);
      }
      const failed = results.filter((r) => !r.ok).length;
      console.log(`[yapboard] broadcast: posted ${results.length - failed} of ${results.length}${failed ? ` (${failed} failed)` : ''}`);
    }
    return !stopped && results.length === job.deliveries.length;
  };

  const tick = async () => {
    let more = true;
    // Keep going while a broadcast is still draining, then fall back to the slow poll.
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
