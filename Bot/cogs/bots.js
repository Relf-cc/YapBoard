// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { isInServer, isOwnerOrAdmin } from '../lib/perms.js';
import { answer, card, fileUrl, serverIdOf, siteLink } from '../lib/ui.js';

/** Yapin' IDs are letters, numbers, - and _ — the same set the site's add pages accept. */
const ID = '[A-Za-z0-9_-]{1,64}';
/** The composer sends a mention as <@id>; some clients add the ! form. */
const MENTION = new RegExp(`<@!?(${ID})>`);
const BARE = new RegExp(`^${ID}$`);

const usage = () =>
  card({
    title: 'Which bot?',
    description: [
      'Mention the bot you want to list, in its support server:',
      '',
      '**`/addbot @YourBot`**',
      '',
      'That fills in the bot’s ID and this server’s ID for you, so the form opens ready to finish. If the mention',
      'doesn’t work in your client, paste the ID instead: `/addbot 2b81f05c…`',
    ].join('\n'),
    tone: 'muted',
  });

/** Shown with the usage card: the walkthrough covers the bits a card can't. */
const HELP_LINK = ['How listing works', siteLink('/bots/help')];

/** /addbot: turns a mention into a part-filled bot listing. */
export default function setup(bot) {
  bot.command('addbot', 'List a bot you run: /addbot @YourBot', async (msg) => {
    const serverId = await serverIdOf(bot, msg);
    if (!serverId) {
      return answer(msg, card({ description: 'Run `/addbot` in the bot’s support server, not in DMs — the server is half of what gets filled in.', tone: 'muted' }));
    }

    const mention = MENTION.exec(msg.args || '');
    const first = (msg.argv[0] || '').trim();
    const botId = mention ? mention[1] : BARE.test(first) ? first : null;
    if (!botId) return answer(msg, usage(), HELP_LINK);

    if (bot.me?.id && String(botId) === String(bot.me.id)) {
      return answer(msg, card({ title: 'That’s me', description: 'Mention the bot you want to list, not YapBoard.', tone: 'muted' }), ['Browse bots', siteLink('/bots')]);
    }

    /**
     * Listing a bot here claims this server as its support server, and that claim is the whole proof the bot is
     * yours (Site/src/app/api/bots/route.ts). So only someone who runs the server may start it. The site checks
     * the same thing again when the form is submitted — this is the friendly half, not the security half.
     */
    if (!(await isOwnerOrAdmin(bot, serverId, msg.author_id))) {
      return answer(
        msg,
        card({
          title: 'Only the owner or an admin',
          description: 'Listing a bot here tells YapBoard that this server supports it, which is how we know the bot is yours. Ask the server’s owner, or someone with a Manage Server role, to run this.',
          tone: 'error',
        }),
      );
    }

    const target = await bot.user(botId).catch(() => null);
    if (!target) {
      return answer(msg, card({ title: 'No such account', description: `Yapin’ doesn’t know anyone with the ID \`${botId}\`. Mention the bot instead: \`/addbot @YourBot\`.`, tone: 'error' }));
    }

    const name = target.display_name || target.username || 'your bot';

    /**
     * Yapin' won't say whether an account is a bot, so "it's in the server you run" is the closest check there
     * is, and the site makes the same one when the form is submitted. Refusing here saves a wasted trip.
     */
    if ((await isInServer(bot, serverId, botId)) === false) {
      return answer(
        msg,
        card({
          title: `${name} isn’t in this server`,
          description: 'A bot’s support server has to be one the bot is actually in. Add it here first, then run `/addbot` again.',
          tone: 'error',
        }),
      );
    }

    const url = `${siteLink('/bots/add')}?bot=${encodeURIComponent(botId)}&server=${encodeURIComponent(serverId)}`;

    return answer(
      msg,
      card({
        title: `List ${name} on YapBoard`,
        description: 'Both IDs are filled in already. Open the form, add a summary and a few tags, and send it in — a staff member checks it before it goes on the board.\n\nCheck the name above is the right bot before you finish.',
        icon: fileUrl('avatars', target.avatar_url ?? target.avatar_path ?? target.avatar),
      })
        .field('Bot', `\`${botId}\``, true)
        .field('Support server', `\`${serverId}\``, true),
      ['Finish the listing', url],
    );
  });
}
