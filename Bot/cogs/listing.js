import * as yapboard from '../lib/yapboard.js';
import { createReminders } from '../lib/reminders.js';
import { answer, authorOf, card, cooldownBar, memberCountOf, number, serverIdOf, siteLink, tagLine, until } from '../lib/ui.js';

const STATUS = { PUBLIC: 'Public', UNLISTED: 'Unlisted', HIDDEN: 'Hidden by staff', REMOVED: 'Removed' };
const BADGE = { VERIFIED: 'Verified on YapBoard', OFFICIAL: 'Official Yapin’ server' };

const OFFLINE = () => card({ title: 'YapBoard is out of reach', description: 'Couldn’t reach the site just now. Try again in a minute.', tone: 'error' });

const notListed = () =>
  card({
    title: 'Not on YapBoard yet',
    description: [
      'This server isn’t listed, so there’s nothing to bump. Listing takes a couple of minutes:',
      '',
      '**1.** Open the link below and pick this server',
      '**2.** Write a one-line summary and add a few tags',
      '**3.** Come back here and type `/bump`',
    ].join('\n'),
    tone: 'muted',
  });

/** "Not yet" with a bar showing how far through the 2 hours we are. */
const tooSoon = ({ name, iconUrl, nextAt }) =>
  card({
    title: 'Not yet',
    description: `**${name ?? 'This server'}** was bumped recently.\n\n${nextAt ? `${cooldownBar(nextAt)}  next bump in **${until(nextAt)}**` : 'Try again in a bit.'}`,
    tone: 'muted',
    icon: iconUrl,
  });

let reminders = null;

/** /bump and /yapboard: everything that talks to the site about one listing. */
export default async function setup(bot) {
  /** serverId → { at, name, iconUrl }, so /bump spam during the cooldown doesn't hit the site. */
  const cooldowns = new Map();

  reminders = createReminders(async (serverId, channelId) => {
    const l = await yapboard.listing(serverId);
    if (!l.listed || l.status !== 'PUBLIC') return null;
    // Bumped from the website meanwhile: wait for that cooldown instead.
    if (l.nextBumpAt && new Date(l.nextBumpAt).getTime() > Date.now()) return l.nextBumpAt;
    await bot.send(channelId, '', {
      embeds: [
        card({
          title: 'Ready to bump',
          description: `**${l.name}** can be bumped again.\nType \`/bump\` to put it back at the top of YapBoard.`,
          tone: l.accent,
          icon: l.iconUrl,
          time: true,
        }),
      ],
    });
    return null;
  });

  const load = async () => {
    const n = await reminders.load();
    if (n) console.log(`[yapboard] ${n} bump reminder${n === 1 ? '' : 's'} waiting`);
  };
  // Loaded before start(): wait until we're online. Reloaded later: pick them up now.
  if (bot.me) await load();
  else bot.on('ready', load);

  bot.command('bump', 'Move this server to the top of YapBoard (every 2 hours)', async (msg) => {
    const serverId = await serverIdOf(bot, msg);
    if (!serverId) return answer(msg, card({ description: 'Run `/bump` in a server, not in DMs.', tone: 'muted' }));

    const known = cooldowns.get(serverId);
    if (known && known.at > Date.now()) return answer(msg, tooSoon({ ...known, nextAt: known.at }));

    const [user, server] = await Promise.all([authorOf(bot, msg), bot.server(serverId).catch(() => null)]);
    let res;
    try {
      res = await yapboard.bump({ serverId, user, memberCount: memberCountOf(server) });
    } catch (e) {
      console.error('[yapboard] /bump:', e.message);
      return answer(msg, OFFLINE());
    }

    if (res.nextAt) cooldowns.set(serverId, { at: new Date(res.nextAt).getTime(), name: res.name, iconUrl: res.iconUrl });

    if (res.ok) {
      await reminders.set(serverId, msg.channel_id, res.nextAt);
      const members = memberCountOf(server);
      const e = card({
        title: `${res.name} is at the top`,
        description: `Thanks for the bump, ${msg.authorMention}. I’ll post here when the next one is ready.`,
        tone: res.accent,
        icon: res.iconUrl,
        url: res.url,
        author: { name: `Bumped by ${user.displayName || user.username}`, icon: user.avatarUrl },
        time: true,
      })
        .field('Bump', `#${number(res.bumpCount)}`, true)
        .field('Next bump', `in ${until(res.nextAt)}`, true);
      if (members !== undefined) e.field('Members', number(members), true);
      return answer(msg, e, ['View listing', res.url]);
    }
    switch (res.reason) {
      case 'cooldown':
        return answer(msg, tooSoon(res));
      case 'not_found':
        return answer(msg, notListed(), ['List this server', res.addUrl]);
      case 'not_listed':
        return answer(
          msg,
          card({ title: 'Bumping is paused', description: `**${res.name}** is unlisted or hidden, so it can’t be bumped right now. The owner can see why on the listing’s manage page.`, tone: 'muted', icon: res.iconUrl }),
          ['Manage listing', siteLink(`/manage/${serverId}`)],
        );
      case 'banned':
        return answer(msg, card({ title: 'You can’t bump', description: 'Your account is banned from YapBoard. Anyone else here can still bump.', tone: 'error' }));
      default:
        return answer(msg, OFFLINE());
    }
  });

  bot.command('yapboard', 'This server’s YapBoard listing and stats', async (msg) => {
    const serverId = await serverIdOf(bot, msg);
    if (!serverId) return answer(msg, card({ description: 'Run `/yapboard` in a server, not in DMs.', tone: 'muted' }));

    let l;
    try {
      l = await yapboard.listing(serverId);
    } catch (e) {
      console.error('[yapboard] /yapboard:', e.message);
      return answer(msg, OFFLINE());
    }
    if (!l.listed) return answer(msg, notListed(), ['List this server', l.addUrl]);

    const live = l.status === 'PUBLIC';
    const viewable = live || l.status === 'UNLISTED';
    const ready = !l.nextBumpAt || new Date(l.nextBumpAt).getTime() <= Date.now();
    const e = card({
      title: l.name,
      description: [l.summary, tagLine(l.tags)].filter(Boolean).join('\n\n'),
      tone: live ? l.accent : 'muted',
      icon: l.iconUrl,
      url: viewable ? l.url : null,
      author: BADGE[l.badge] ? { name: BADGE[l.badge] } : { name: 'YapBoard listing' },
    })
      .field('Members', number(l.memberCount), true)
      .field('Bumps', number(l.bumpCount), true)
      .field('Next bump', !live ? '—' : ready ? '**Ready now**' : `in ${until(l.nextBumpAt)}`, true)
      .field('Views', number(l.views), true)
      .field('Joins', number(l.joins), true)
      .field('Status', STATUS[l.status] || l.status, true);
    return answer(msg, e, ['View listing', viewable ? l.url : null], ['Manage', l.manageUrl]);
  });
}

export function teardown() {
  reminders?.stop();
}
