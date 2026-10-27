// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { isInServer, isOwnerOrAdmin } from '../lib/perms.js';
import { answer, card, fileUrl, serverIdOf, siteLink } from '../lib/ui.js';

/** Yapin' IDs are letters, numbers, - and _ — the same set the site's add pages accept. */
const ID = '[A-Za-z0-9_-]{1,64}';
/** Mentions reach us as <@id> in the content; some clients add the ! form. */
const MENTION = new RegExp(`<@!?(${ID})>`);
const BARE = new RegExp(`^${ID}$`);

/**
 * Why this takes an ID and not a mention.
 *
 * On Yapin' a mention in a command picks which bot the command is for: "/addbot @YourBot" is routed to YourBot,
 * which has no such command, and we are handed the message with `command_for` set to it and no `command` at all.
 * Mentioning YapBoard instead routes it to us, but the mention is eaten by the picker, so `args` arrives empty.
 * Either way the mention never reaches us as an argument, so the bot is named by its ID.
 */
/** Where a bot's own id comes from, in the words the site's /add page already uses. */
const WHERE = 'Your bot’s ID is the one you paste into **Server settings → Bots → Have a bot ID?** when you add it to a server.';

const usage = () =>
  card({
    title: 'Which bot?',
    description: [
      'Run this in the server that supports your bot, with **your bot’s** ID:',
      '',
      '**`/addbot 2b81f05c…`**',
      '',
      WHERE,
      '',
      '**Don’t @ the bot.** On Yapin’ a mention picks which bot a command is for, so `/addbot @YourBot` gets sent ' +
        'to your bot instead of to me, and I never see it.',
    ].join('\n'),
    tone: 'muted',
  });

/** They @'d YapBoard: the command reached us, but Yapin' ate the mention, so there's nothing to list. */
const mentionedMe = () =>
  card({
    title: 'Send your bot’s ID instead',
    description: [
      'Mentioning me picked me as the bot to send the command to — it doesn’t tell me which bot you want to list, ' +
        'and Yapin’ strips the mention before I see it.',
      '',
      'Send the ID of **the bot you want to list**: **`/addbot 2b81f05c…`**',
      '',
      WHERE,
    ].join('\n'),
    tone: 'muted',
  });

/**
 * They pasted my id. Easy to do straight after the card above, so this says plainly whose id it is rather than
 * repeating the mention explanation, which wouldn't make sense when no mention was used.
 */
const selfId = () =>
  card({
    title: 'That’s my ID, not your bot’s',
    description: [
      'That one belongs to me, the YapBoard bot — I’m already here, and there’s nothing to list.',
      '',
      'I need the ID of **the bot you want to list**: **`/addbot 2b81f05c…`**',
      '',
      WHERE,
    ].join('\n'),
    tone: 'muted',
  });

/** They @'d their own bot, so Yapin' sent the command there and we only see the plain message. */
const wentElsewhere = () =>
  card({
    title: 'That went to your bot, not to me',
    description: [
      'On Yapin’ a mention picks which bot a command is for, so `/addbot @YourBot` was sent to your bot, which ' +
        'doesn’t have the command.',
      '',
      'Name it by ID instead: **`/addbot 2b81f05c…`**',
      '',
      'It’s the ID you paste into **Server settings → Bots → Have a bot ID?**',
    ].join('\n'),
    tone: 'muted',
  });

/** Shown with the usage cards: the walkthrough covers the bits a card can't. */
const HELP_LINK = ['How listing works', siteLink('/bots/help')];

/** /addbot: turns a bot's ID into a part-filled listing, with the server it was run in as the support server. */
export default function setup(bot) {
  bot.command('addbot', 'List a bot you run: /addbot <bot id>', async (msg) => {
    const serverId = await serverIdOf(bot, msg);
    if (!serverId) {
      return answer(msg, card({ description: 'Run `/addbot` in the bot’s support server, not in DMs — the server is half of what gets filled in.', tone: 'muted' }));
    }

    const first = (msg.argv[0] || '').trim();
    // `args` is the usual source; the content is checked too, since the picker mention only ever shows up there.
    const mention = MENTION.exec(msg.args || '') || MENTION.exec(msg.content || '');
    const pasted = BARE.test(first);
    const botId = pasted ? first : mention ? mention[1] : null;
    if (!botId) return answer(msg, mention ? mentionedMe() : usage(), HELP_LINK);

    // Naming me is a dead end either way, but how they named me decides which explanation helps.
    if (bot.me?.id && String(botId) === String(bot.me.id)) {
      return answer(msg, pasted ? selfId() : mentionedMe(), HELP_LINK);
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
      return answer(msg, card({ title: 'No such account', description: `Yapin’ doesn’t know anyone with the ID \`${botId}\`. Copy the bot’s own ID, not the server’s.`, tone: 'error' }), HELP_LINK);
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

  /**
   * "/addbot @TheirBot" is routed to their bot, so our command never runs — but the message still reaches us.
   * Without this it looks like YapBoard simply ignored them.
   */
  bot.on('message', (msg) => {
    if (msg.command) return;
    if (!/^\s*[/!]addbot\b/i.test(msg.content || '')) return;
    answer(msg, wentElsewhere(), HELP_LINK);
  });
}
