// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { createRequire } from 'node:module';
import * as yapboard from '../lib/yapboard.js';
import { isOwnerOrAdmin } from '../lib/perms.js';
import { answer, card, duration, number, serverIdOf, STATUS } from '../lib/ui.js';
import { config } from '../lib/config.js';

const { version } = createRequire(import.meta.url)('../package.json');

/** Time one call. Never throws: a failed check is part of the answer. */
async function timed(fn) {
  const started = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - started, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e?.message || String(e) };
  }
}

/** "ok · 84ms", or the reason it isn't ok. Messages can carry URLs and IDs, so they're kept short. */
const result = (r) => (r.ok ? `ok · ${number(r.ms)}ms` : `**failed** after ${number(r.ms)}ms\n${String(r.error).slice(0, 180)}`);

const host = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * /debug: is the bot healthy, and can it still reach Yapin' and the site? Everything here is either public
 * (hosts, versions) or something the asker could already see, so there's no secret in the card - but it's still
 * owner-and-admin only, because it's noise for everyone else and an easy thing to spam.
 */
export default function setup(bot) {
  bot.command('debug', 'Owner and admins: check the bot, Yapin’ and the site are healthy', async (msg) => {
    const serverId = await serverIdOf(bot, msg);
    if (!serverId) return answer(msg, card({ description: 'Run `/debug` in a server, not in DMs.', tone: 'muted' }));

    if (!(await isOwnerOrAdmin(bot, serverId, msg.author_id))) {
      return answer(
        msg,
        card({
          title: 'Only the owner or an admin',
          description: 'Ask the server’s owner, or someone with a Manage Server role, to run `/debug`.',
          tone: 'error',
        }),
      );
    }

    // Both checks at once: together they're the whole path a /bump takes.
    const [yapin, site] = await Promise.all([
      timed(() => bot.api('GET', '/me', undefined, { retries: 0 })),
      timed(() => yapboard.listing(serverId)),
    ]);

    const servers = await bot.servers().catch(() => null);
    const listing = site.ok ? site.value : null;
    const healthy = yapin.ok && site.ok;
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);

    const e = card({
      title: healthy ? 'Everything’s up' : 'Something’s down',
      description: healthy
        ? 'The bot can reach Yapin’ and YapBoard, so `/bump` should work here.'
        : 'One of the two checks below failed. Until it’s back, commands that need it will say so.',
      tone: healthy ? 'accent' : 'error',
      time: true,
    })
      .field('Yapin’ API', result(yapin), true)
      .field(`YapBoard (${host(config.apiUrl)})`, result(site), true)
      .field(
        'Bot',
        [
          `v${version} on Node ${process.versions.node}`,
          `up ${duration(process.uptime() * 1000)} · ${mem}MB`,
          `events: ${bot.gateway ? 'gateway' : 'long poll'}`,
        ].join('\n'),
        true,
      )
      .field(
        'Loaded',
        [
          `${number(bot.commands.size)} command${bot.commands.size === 1 ? '' : 's'}`,
          `${number(bot.cogs.size)} cog${bot.cogs.size === 1 ? '' : 's'}: ${[...bot.cogs.keys()].join(', ')}`,
          servers ? `${number(servers.length)} server${servers.length === 1 ? '' : 's'}` : 'server list unavailable',
        ].join('\n'),
        true,
      )
      .field(
        'Here',
        [
          `server \`${serverId}\``,
          `channel \`${msg.channel_id}\``,
          site.ok ? (listing.listed ? `listing: ${STATUS[listing.status] || listing.status}` : 'listing: not listed') : 'listing: unknown',
        ].join('\n'),
        true,
      );

    return answer(msg, e);
  });
}
