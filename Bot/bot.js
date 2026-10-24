// YapBoard bot: /bump, /yapboard, /invite, /help. Run with `npm start` (Node 20.12+; 22+ uses the faster gateway).
import { Bot } from './lib/yapper.js';
import { checkConfig, config } from './lib/config.js';
import { setBrand } from './lib/ui.js';

const problems = checkConfig();
if (problems.length) {
  console.error(`[yapboard] can't start, fix Bot/.env first (see .env.example):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

const bot = new Bot(config.token);

bot.on('ready', (me) => {
  setBrand(me);
  console.log(`[yapboard] talking to ${config.siteUrl}, bot ID ${me.id} (the site's NEXT_PUBLIC_BOT_ID)`);
  bot.setStatus('online', '/bump').catch(() => {});
});

await bot.loadCogs('./cogs');

const shutdown = () => {
  console.log('[yapboard] stopping…');
  bot.stop();
  // The long poll can take up to 25s to return; don't make Ctrl+C wait for it. A second lets reminders finish saving.
  setTimeout(() => process.exit(0), 1_000);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bot.start().catch((e) => {
  console.error('[yapboard] could not start:', e.message);
  process.exit(1);
});
