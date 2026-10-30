// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import * as yapboard from '../lib/yapboard.js';
import { answer, card, fileUrl, memberCountOf, number, quote, serverIdOf, siteLink, stars, STATUS, viewable } from '../lib/ui.js';

// Same wording as the site's /bot page.
const HELP = [
  ['/bump', 'Moves your server to the top of the list. Anyone in the server can do it, once every 2 hours.'],
  ['/yapboard', 'Owner and admins: your listing’s stats (only you see them), or a link to list the server.'],
  ['/info', 'This server’s details - name, ID, members - and whether it’s on YapBoard.'],
  ['/reviews', 'What people have said about this server on YapBoard.'],
  ['/addbot', 'Owner and admins: start a bot listing. `/addbot <bot id>` fills the IDs in for you.'],
  ['/invite', 'Gets the link to add YapBoard to another server.'],
  ['/debug', 'Owner and admins: checks the bot, Yapin’ and the site are healthy, and shows this server’s IDs.'],
  ['/help', 'Lists the commands.'],
];

/** /help, /invite, /info and answering @mentions. */
export default function setup(bot) {
  const help = () => {
    const e = card({ title: 'YapBoard', description: 'Get your server found on Yapin’. List it once, then bump it every 2 hours to stay near the top.' });
    for (const [cmd, body] of HELP) e.field(cmd, body);
    return e;
  };

  bot.command('help', 'What the YapBoard bot can do', (msg) => answer(msg, help(), ['Browse servers', siteLink('/servers')], ['List a server', siteLink('/add')]));


  /**
   * What people have written about this server.
   *
   * Reading here, writing on the site. A star picker does not fit in a chat message, and the review worth
   * reading is longer than one somebody taps into a channel - so this shows enough to be worth the look and
   * links out for the rest. Owner-answered reviews come first, which is the site's order too.
   */
  bot.command('reviews', 'What people have said about this server on YapBoard', async (msg) => {
    const serverId = await serverIdOf(bot, msg);
    if (!serverId) return answer(msg, card({ description: 'Run `/reviews` in a server, not in DMs.', tone: 'muted' }));

    let res;
    try {
      res = await yapboard.reviews(serverId);
    } catch (e) {
      console.error('[yapboard] /reviews:', e.message);
      return answer(msg, card({ description: 'Couldn\u2019t reach YapBoard just now. Try again in a minute.', tone: 'error' }));
    }

    if (!res.listed) {
      return answer(
        msg,
        card({ title: 'Not listed yet', description: 'This server isn\u2019t on YapBoard, so there\u2019s nothing to review. Listing it takes a couple of minutes.', tone: 'muted' }),
        ['List this server', res.addUrl],
      );
    }
    if (res.paused) {
      return answer(msg, card({ title: res.name, description: 'Reviews are paused on YapBoard right now.', tone: 'muted' }), ['View listing', res.url]);
    }
    if (!res.reviewCount) {
      return answer(
        msg,
        card({
          title: `No reviews of ${res.name} yet`,
          description: 'Nobody has reviewed this server on YapBoard. If you\u2019re in here, you\u2019re the best placed person to say what it\u2019s like.',
          tone: res.accent,
          icon: res.iconUrl,
        }),
        ['Write the first one', `${res.url}#reviews`],
      );
    }

    const e = card({
      title: res.name,
      description: `**${res.reviewCount}** review${res.reviewCount === 1 ? '' : 's'}${res.rating ? ` \u00b7 **${res.rating}** out of 5` : ''}`,
      tone: res.accent,
      icon: res.iconUrl,
      url: res.url,
    });
    for (const r of res.reviews) {
      const reply = r.ownerReply ? `\n\u21b3 **Owner:** ${quote(r.ownerReply, 110)}` : '';
      e.field(`${stars(r.rating)}  ${r.writer}`, `${quote(r.body)}${reply}`);
    }
    return answer(msg, e, ['Read them all', `${res.url}#reviews`]);
  });

  bot.command('invite', 'Add YapBoard to another server', (msg) =>
    answer(
      msg,
      card({ title: 'Add YapBoard to a server', description: 'You need Manage Server in the server you’re adding it to.' })
        .field('1. Open the bot settings', 'In Yapin’: **Server settings → Bots → Have a bot ID?**')
        .field('2. Paste this ID', `\`\`\`\n${bot.me?.id ?? '…'}\n\`\`\``)
        .field('3. List and bump', 'List the server on YapBoard, then type `/bump` there.'),
      ['Bot page', siteLink('/bot')],
    ),
  );

  /**
   * What Yapin' knows about this server, plus where it stands on YapBoard. The ID is in a code block because
   * copying it is the point: it's what the site's forms ask for, and nothing else hands it out.
   */
  bot.command('info', 'This server’s details, and whether it’s on YapBoard', async (msg) => {
    const serverId = await serverIdOf(bot, msg);
    if (!serverId) return answer(msg, card({ description: 'Run `/info` in a server, not in DMs.', tone: 'muted' }));

    const server = await bot.server(serverId).catch(() => null);
    // The site is optional here: if it's down we can still answer with everything Yapin' told us.
    const listing = await yapboard.listing(serverId).catch(() => null);
    const listed = listing?.listed === true;
    // listing === null means the site didn't answer, which is not the same as "not listed".
    const unknown = listing === null;
    // Hidden and removed listings still count as listed, but there's no page to link to.
    const canView = listed && viewable(listing.status);
    const members = memberCountOf(server);

    const e = card({
      title: server?.name || 'This server',
      description: unknown
        ? 'Couldn’t reach YapBoard just now, so I can’t say whether this server is listed.'
        : listed
          ? null
          : 'Not on YapBoard yet. Listing it takes a couple of minutes.',
      tone: listed && listing.status === 'PUBLIC' ? 'accent' : 'muted',
      icon: fileUrl('icons', server?.icon_path ?? server?.icon),
      url: canView ? listing.url : null,
    }).field('Server ID', `\`\`\`\n${serverId}\n\`\`\``);

    if (members !== undefined) e.field('Members', number(members), true);
    if (server?.owner_id != null) e.field('Owner', `<@${server.owner_id}>`, true);
    if (listed) {
      e.field('Bumps', number(listing.bumpCount), true);
      e.field('On YapBoard', STATUS[listing.status] || listing.status, true);
    } else if (listing) {
      e.field('On YapBoard', 'Not listed', true);
    }

    return answer(
      msg,
      e,
      listed ? ['View listing', canView ? listing.url : null] : ['List this server', listing?.addUrl ?? siteLink(`/add?server=${encodeURIComponent(serverId)}`)],
      ['List a bot here', siteLink(`/bots/add?server=${encodeURIComponent(serverId)}`)],
    );
  });

  // "@YapBoard" with nothing else (or anything that isn't a command): point at /help.
  bot.on('message', (msg) => {
    if (msg.mentioned && !msg.command) answer(msg, help(), ['Browse servers', siteLink('/servers')], ['List a server', siteLink('/add')]);
  });
}
