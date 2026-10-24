import { answer, card, siteLink } from '../lib/ui.js';

// Same wording as the site's /bot page.
const HELP = [
  ['/bump', 'Moves your server to the top of the list. Anyone in the server can do it, once every 2 hours.'],
  ['/yapboard', 'Owner and admins: your listing’s stats (only you see them), or a link to list the server.'],
  ['/invite', 'Gets the link to add YapBoard to another server.'],
  ['/help', 'Lists the commands.'],
];

/** /help, /invite and answering @mentions. */
export default function setup(bot) {
  const help = () => {
    const e = card({ title: 'YapBoard', description: 'Get your server found on Yapin’. List it once, then bump it every 2 hours to stay near the top.' });
    for (const [cmd, body] of HELP) e.field(cmd, body);
    return e;
  };

  bot.command('help', 'What the YapBoard bot can do', (msg) => answer(msg, help(), ['Browse servers', siteLink('/servers')], ['List a server', siteLink('/add')]));

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

  // "@YapBoard" with nothing else (or anything that isn't a command): point at /help.
  bot.on('message', (msg) => {
    if (msg.mentioned && !msg.command) answer(msg, help(), ['Browse servers', siteLink('/servers')], ['List a server', siteLink('/add')]);
  });
}
