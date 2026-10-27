// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
// Demo data for local dev: `npm run db:seed` (or `npm run db:reset` to start clean).
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// [name, summary, tags, members, language, nsfw]
const SERVERS = [
  ['Yapin’ Developers', 'The official place to build bots and apps on Yapin’. SDK help, API news and showcases.', ['developers', 'bots', 'programming', 'official'], 3260, 'en'],
  ['The Yap Shack', 'Late-night chats, bad takes and good people. Come yap.', ['community', 'chill', 'social', 'memes'], 4820, 'en'],
  ['Valorant Grind Club', 'Find a five-stack, review VODs, climb together. All ranks welcome.', ['valorant', 'fps', 'gaming', 'lfg', 'competitive'], 12940, 'en'],
  ['Pixel Pals', 'Pixel artists sharing WIPs, palettes and weekly prompts.', ['pixel-art', 'art', 'creative', 'feedback'], 2310, 'en'],
  ['Study With Strangers', 'Pomodoro rooms on voice, accountability threads and exam season survival.', ['study', 'productivity', 'students', 'voice'], 8730, 'en'],
  ['Anime Afterhours', 'Seasonal discussion, watch parties every Friday, zero gatekeeping.', ['anime', 'manga', 'watch-party', 'social'], 15420, 'en'],
  ['Minecraft Cozy SMP', 'Whitelisted survival server with farms, shops and a very serious town council.', ['minecraft', 'smp', 'gaming', 'survival'], 1640, 'en'],
  ['Lo-fi Lounge', 'Music on 24/7 in voice. Share what you’re listening to.', ['music', 'lofi', 'chill', 'voice'], 3920, 'en'],
  ['Indie Dev Den', 'Game devs posting devlogs, playtests and jam teams.', ['gamedev', 'programming', 'indie', 'feedback'], 6210, 'en'],
  ['Code & Coffee', 'Web devs helping each other ship. Code reviews, career chat, no gatekeeping.', ['programming', 'webdev', 'javascript', 'career'], 9480, 'en'],
  ['League Of Yappers', 'Clash teams, ranked duos, ARAM nights and a lot of copium.', ['league-of-legends', 'moba', 'gaming', 'lfg'], 7230, 'en'],
  ['Bookworm Burrow', 'Monthly book club, buddy reads and endless TBR piles.', ['books', 'reading', 'book-club', 'chill'], 1180, 'en'],
  ['Kpop Central', 'Comebacks, streaming parties and fancams. Every fandom welcome.', ['kpop', 'music', 'fandom', 'social'], 11300, 'en'],
  ['Fitness Accountability', 'Log your workouts, share meals, get hyped. Beginner friendly.', ['fitness', 'health', 'accountability', 'community'], 2890, 'en'],
  ['Retro Respawn', 'Emulation, CRTs, speedruns and arguing about the best console.', ['retro', 'gaming', 'speedrun', 'emulation'], 1420, 'en'],
  ['Comunidad Hispana', 'El servidor para hablar de todo en español. Juegos, música y memes.', ['spanish', 'community', 'gaming', 'memes'], 5640, 'es'],
  ['Le Coin Français', 'Discussions, soirées jeux et entraide. Bienvenue à tous !', ['french', 'community', 'social', 'gaming'], 2470, 'fr'],
  ['Deutsche Zocker', 'Deutschsprachige Gaming-Community mit wöchentlichen Events.', ['german', 'gaming', 'community', 'events'], 3310, 'de'],
  ['Brasil Yap', 'Galera brasileira reunida pra jogar, conversar e zoar.', ['portuguese', 'brazil', 'gaming', 'social'], 6870, 'pt'],
  ['Nihongo Practice', 'Practice Japanese with natives and learners. Voice rooms by level.', ['japanese', 'language-learning', 'study', 'voice'], 4150, 'ja'],
  ['Photography Hub', 'Weekly themes, gear talk and kind critique.', ['photography', 'art', 'creative', 'feedback'], 1960, 'en'],
  ['Crypto Free Finance', 'Budgeting, investing basics and FIRE talk. No shilling, ever.', ['finance', 'investing', 'money', 'career'], 3780, 'en'],
  ['Tabletop Tavern', 'Find D&D groups, share homebrew and roll some dice.', ['dnd', 'tabletop', 'roleplay', 'lfg'], 5520, 'en'],
  ['Cozy Gamers', 'Stardew, Animal Crossing, cosy co-op. Wholesome only.', ['cozy', 'gaming', 'wholesome', 'chill'], 8990, 'en'],
  ['Apex Legends LFG', 'Ranked, pubs and mixtape. Find your trio fast.', ['apex-legends', 'fps', 'lfg', 'gaming'], 6040, 'en'],
  ['Fortnite Builders', 'Box fights, creative maps and tournament scrims.', ['fortnite', 'battle-royale', 'gaming', 'competitive'], 10220, 'en'],
  ['Art Den', 'Digital and traditional artists. Commissions board and monthly challenges.', ['art', 'digital-art', 'commissions', 'creative'], 7310, 'en'],
  ['Meme Factory', 'Fresh memes daily. Templates, OC and mild chaos.', ['memes', 'funny', 'community', 'social'], 18400, 'en'],
  ['Night Owls', 'For people who are awake at 3am for no good reason.', ['chill', 'social', 'night-owls', 'voice'], 2050, 'en'],
  ['Linux Lab', 'Distros, dotfiles and helping each other unbreak things.', ['linux', 'programming', 'tech', 'open-source'], 4460, 'en'],
  ['Rocket League Rumble', '2v2 and 3v3 teams, replay reviews and weekly cups.', ['rocket-league', 'gaming', 'competitive', 'lfg'], 3120, 'en'],
  ['Writers Room', 'Sprints, critique swaps and NaNoWriMo every November.', ['writing', 'creative', 'feedback', 'books'], 1730, 'en'],
  ['Hip Hop Heads', 'New drops, classics, producers sharing beats.', ['hip-hop', 'music', 'production', 'social'], 4990, 'en'],
  ['Genshin Travellers', 'Co-op, builds, theorycrafting and pull reactions.', ['genshin-impact', 'gacha', 'gaming', 'rpg'], 13700, 'en'],
  ['Plant Parents', 'Houseplant help, propagation swaps and leaf pics.', ['plants', 'gardening', 'wholesome', 'hobbies'], 980, 'en'],
  ['Car Culture', 'JDM, euro, muscle. Builds, meets and track days.', ['cars', 'automotive', 'hobbies', 'community'], 3650, 'en'],
  ['Mental Health Corner', 'A gentle place to talk. Peer support, not therapy.', ['mental-health', 'support', 'wholesome', 'community'], 2740, 'en'],
  ['Roblox Creators', 'Builders and scripters teaming up on games.', ['roblox', 'gamedev', 'gaming', 'programming'], 5260, 'en'],
  ['Chess Club', 'Daily puzzles, arenas and post-game analysis.', ['chess', 'strategy', 'games', 'competitive'], 2210, 'en'],
  ['Türk Oyuncular', 'Türk oyuncular için sohbet ve etkinlik sunucusu.', ['turkish', 'gaming', 'community', 'social'], 3380, 'tr'],
  ['Overwatch Arena', 'Scrims, coaching and hero discussions.', ['overwatch', 'fps', 'competitive', 'lfg'], 4710, 'en'],
  ['Small Server Energy', 'Under 50 people and proud. Everyone knows everyone.', ['small', 'chill', 'community', 'social'], 34, 'en'],
  ['Night City Roleplay', 'Cyberpunk text roleplay with a living story.', ['roleplay', 'cyberpunk', 'writing', 'community'], 860, 'en'],
  ['After Dark Lounge', 'Adults-only chat for 18+. Verification required.', ['adult', 'social', 'chill'], 2400, 'en', true],
  ['Speedrun Central', 'Routes, splits and world record watch parties.', ['speedrun', 'gaming', 'retro', 'competitive'], 1890, 'en'],
  ['Film Buffs', 'Weekly movie nights and long arguments about endings.', ['movies', 'film', 'watch-party', 'social'], 3090, 'en'],
  ['Hackathon Hub', 'Find teammates, share projects, win prizes.', ['programming', 'hackathons', 'career', 'tech'], 2560, 'en'],
];

// Staff badges (src/lib/badges.ts). A server can hold several.
const BADGE = {
  'Yapin’ Developers': ['OFFICIAL', 'FOUNDER'],
  'Valorant Grind Club': ['VERIFIED', 'FEATURED', 'TRENDING'],
  'Code & Coffee': ['VERIFIED', 'FOUNDER', 'VETERAN', 'FAVOURITE'],
  'Anime Afterhours': ['VERIFIED', 'PARTNER'],
  'Study With Strangers': ['VERIFIED', 'FAVOURITE'],
  'Lo-fi Lounge': ['FOUNDER', 'VETERAN'],
  'Speedrun Central': ['FEATURED'],
  'Film Buffs': ['PARTNER', 'TRENDING'],
};

const DESC = (name, tags) => `Welcome to **${name}**.

We started as a handful of friends and grew into a proper community. It's a friendly place, mods actually reply, and new people get a proper hello.

- Channels for ${tags.slice(0, 3).join(', ')}
- Weekly events in voice
- Roles you can pick yourself
- No spam, no drama

Read the rules when you join and grab your roles. See you inside.`;

// [name, summary, prefix, tags, servers, library]
const BOTS = [
  ['Yapper', 'The official Yapin’ example bot. Moderation, roles and a good night’s sleep.', null, ['moderation', 'utility', 'official'], 18400, 'yapper.js'],
  ['Tunebox', 'Music in voice without the nonsense. Queues, playlists, no paywall.', '!', ['music', 'voice', 'fun'], 9340, 'yapper.js'],
  ['Gatekeep', 'Verification, anti-raid and a very patient audit log.', null, ['moderation', 'security', 'utility'], 6120, 'yapper.js'],
  ['Pollster', 'Polls, votes and scheduled questions your server will actually answer.', '?', ['utility', 'polls', 'community'], 3480, 'yapper.js'],
  ['Levels', 'XP, ranks and leaderboards. Configurable down to the last pixel.', null, ['levels', 'community', 'fun'], 7750, 'yapper.js'],
  ['Ticketly', 'Support tickets with transcripts, so nothing gets lost in DMs.', '-', ['support', 'utility', 'moderation'], 2210, 'yapper.js'],
];

// [name, summary, platforms, framework, repo, version, tags]
// Clients are somebody's own build of Yapin'. Seeded with MANUAL links so a dev database never reaches GitHub.
const CLIENTS = [
  ['Yapin’ Plus', 'Themes, plugins and a compact layout, without touching the official app’s manners.', ['windows', 'mac', 'linux'], 'Electron', 'yapboard-demo/yapin-plus', 'v2.4.1', ['themes', 'plugins', 'customisation']],
  ['Lightyap', 'A 40MB client for old laptops. Same chat, a tenth of the memory.', ['windows', 'linux'], 'Tauri', 'yapboard-demo/lightyap', 'v0.9.3', ['lightweight', 'performance', 'utility']],
  ['Yapterm', 'Yapin’ in your terminal. Keyboard only, mouse optional, vim keys included.', ['linux', 'mac'], 'Rust', 'yapboard-demo/yapterm', 'v1.1.0', ['terminal', 'keyboard', 'developers']],
  ['Pocketyap', 'An unofficial Android build with notification controls the official app won’t give you.', ['android'], 'Kotlin', 'yapboard-demo/pocketyap', 'v3.0.0-beta.2', ['mobile', 'android', 'notifications']],
];

const ACCENTS = ['#ff6b4a', '#ffb86b', '#7ee2a8', '#5aa9e6', '#c7a4ff', '#ff9ecb', '#3fc1a8', '#8fb8ff'];
const rand = (n) => Math.floor(Math.random() * n);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const id = (i) => `srv_${(1000003 * (i + 7)).toString(36)}${i}`;
const botId = (i) => `bot_${(1000033 * (i + 11)).toString(36)}${i}`;
const clientId = (i) => `cli_${(1000081 * (i + 13)).toString(36)}${i}`;

async function main() {
  console.log('Seeding…');
  await db.auditLog.deleteMany();
  await db.report.deleteMany();
  await db.announcement.deleteMany();
  await db.broadcast.deleteMany();
  await db.clientBump.deleteMany();
  await db.clientBadge.deleteMany();
  await db.clientTag.deleteMany();
  await db.clientDownload.deleteMany();
  await db.clientListing.deleteMany();
  await db.botBump.deleteMany();
  await db.botBadge.deleteMany();
  await db.botTag.deleteMany();
  await db.botListing.deleteMany();
  await db.bump.deleteMany();
  await db.serverBadge.deleteMany();
  await db.serverTag.deleteMany();
  await db.tag.deleteMany();
  await db.server.deleteMany();
  await db.user.deleteMany({ where: { id: { startsWith: 'seed-' } } });

  const users = [];
  for (const name of ['mira', 'jonah', 'kai_dev', 'sol', 'nova', 'rhea', 'teo', 'lux', 'pip', 'ash']) {
    users.push(await db.user.create({ data: { id: `seed-${name}`, username: name, displayName: name.replace('_', ' ') } }));
  }

  const now = Date.now();
  for (const [i, [name, summary, tags, members, language, nsfw]] of SERVERS.entries()) {
    const owner = users[i % users.length];
    const createdAt = new Date(now - rand(160) * 864e5 - rand(864e5));
    // Most servers bumped in the last day, some long ago, a few just now.
    const bumpedAgo = i < 8 ? rand(110) * 60_000 : i % 5 === 0 ? rand(20) * 864e5 : rand(24 * 60) * 60_000;
    const serverId = id(i);
    await db.server.create({
      data: {
        id: serverId,
        name,
        summary,
        description: DESC(name, tags),
        inviteUrl: name === 'Yapin’ Developers' ? 'https://yapin.gg/invite/developers' : `https://yapin.gg/invite/${slug(name)}`,
        badges: { create: (BADGE[name] ?? []).map((kind) => ({ kind, grantedAt: createdAt })) },
        language,
        nsfw: !!nsfw,
        accent: ACCENTS[i % ACCENTS.length],
        memberCount: members,
        bumpCount: 5 + rand(400),
        bumpedAt: new Date(Math.max(createdAt.getTime(), now - bumpedAgo)),
        views: members * (2 + rand(6)),
        joins: Math.round(members * (0.2 + Math.random() * 0.5)),
        createdAt: i >= SERVERS.length - 4 ? new Date(now - rand(5) * 864e5) : createdAt,
        ownerId: owner.id,
        tags: {
          create: await Promise.all(
            tags.map(async (t) => ({ tag: { connect: { id: (await db.tag.upsert({ where: { name: t }, create: { name: t }, update: {} })).id } } })),
          ),
        },
      },
    });
    const bumps = 1 + rand(3);
    for (let b = 0; b < bumps; b++) {
      await db.bump.create({ data: { serverId, userId: users[rand(users.length)].id, createdAt: new Date(now - rand(20) * 3600_000) } });
    }
  }

  // Bots. The first one is "official" and points at the Yapin' Developers server for support.
  for (const [i, [name, summary, prefix, tags, servers, library]] of BOTS.entries()) {
    const owner = users[(i + 2) % users.length];
    const createdAt = new Date(now - rand(140) * 864e5);
    const thisBot = botId(i);
    await db.botListing.create({
      data: {
        id: thisBot,
        name,
        summary,
        description: DESC(name, tags),
        prefix,
        library,
        website: i % 2 === 0 ? `https://${slug(name)}.example` : null,
        inviteUrl: i % 3 === 0 ? `https://${slug(name)}.example/add` : null,
        accent: ACCENTS[(i + 3) % ACCENTS.length],
        serverCount: servers,
        views: servers * (1 + rand(4)),
        adds: Math.round(servers * (0.1 + Math.random() * 0.3)),
        bumpCount: 2 + rand(120),
        bumpedAt: new Date(now - rand(40) * 3600_000),
        createdAt,
        // Listings wait for staff by default; the last one is left pending so the review queue isn't empty in dev.
        status: i === BOTS.length - 1 ? 'PENDING' : 'PUBLIC',
        // The official bot's support server is the developers one, which is seeded first.
        supportServerId: i === 0 ? id(0) : i % 2 === 1 ? id(i) : null,
        badges: { create: i === 0 ? [{ kind: 'OFFICIAL', grantedAt: createdAt }] : i === 1 ? [{ kind: 'FEATURED', grantedAt: createdAt }] : [] },
        ownerId: owner.id,
        tags: {
          create: await Promise.all(
            tags.map(async (t) => ({ tag: { connect: { id: (await db.tag.upsert({ where: { name: t }, create: { name: t }, update: {} })).id } } })),
          ),
        },
      },
    });
    for (let b = 0; b < 1 + rand(3); b++) {
      await db.botBump.create({ data: { botId: thisBot, userId: users[rand(users.length)].id, createdAt: new Date(now - rand(40) * 3600_000) } });
    }
  }

  // Clients. Download links are made up and point nowhere real — the point is the shape of the page.
  for (const [i, [name, summary, platforms, framework, repo, version, tags]] of CLIENTS.entries()) {
    const owner = users[(i + 4) % users.length];
    const createdAt = new Date(now - rand(90) * 864e5);
    const thisClient = clientId(i);
    const downloads = 400 + rand(24000);
    const ext = { windows: 'Setup.exe', mac: 'universal.dmg', linux: 'amd64.deb', android: 'arm64.apk', ios: 'ipa', web: 'html', other: 'zip' };
    await db.clientListing.create({
      data: {
        id: thisClient,
        slug: slug(name),
        name,
        summary,
        description: `${summary}

${name} is a community build of Yapin'. It keeps the parts you already know and changes the ones that got in your way.

- Open source, built with ${framework}
- Every release is published on GitHub
- No telemetry, no account automation, nothing hidden

It isn't made by Yapin' or by YapBoard. Read the client terms before you install it.`,
        framework,
        website: i % 2 === 0 ? `https://${slug(name)}.example` : null,
        sourceUrl: `https://github.com/${repo}`,
        accent: ACCENTS[(i + 5) % ACCENTS.length],
        theme: ['GLOW', 'GRID', 'WAVE', 'FLAT'][i % 4],
        platforms: JSON.stringify(platforms),
        screenshots: JSON.stringify([]),
        // MANUAL, so seeding never calls GitHub. Point a listing at a real repo in the UI to try the sync.
        releaseSource: 'MANUAL',
        version,
        releaseName: `${name} ${version}`,
        changelog: `## What's new

- Faster start-up on cold boot
- Fixed the tray icon disappearing after a theme change
- Plugin API: \`onMessage\` now receives edits too

**Full Changelog**: https://github.com/${repo}/compare/v1.0.0...${version}`,
        releaseUrl: `https://github.com/${repo}/releases/tag/${version}`,
        releasedAt: new Date(now - rand(30) * 864e5),
        downloads,
        views: downloads * (1 + rand(3)),
        bumpCount: 1 + rand(60),
        bumpedAt: new Date(now - rand(40) * 3600_000),
        createdAt,
        termsAgreedAt: createdAt,
        // One left pending so the client review queue isn't empty in dev.
        status: i === CLIENTS.length - 1 ? 'PENDING' : 'PUBLIC',
        supportServerId: i % 2 === 0 ? id(i) : null,
        badges: { create: i === 0 ? [{ kind: 'FEATURED', grantedAt: createdAt }] : [] },
        ownerId: owner.id,
        files: {
          create: platforms.map((plat, j) => ({
            platform: plat,
            kind: ext[plat].split('.').pop(),
            arch: plat === 'android' ? 'arm64' : plat === 'mac' ? 'universal' : 'x64',
            label: `${slug(name)}-${version.replace(/^v/, '')}-${ext[plat]}`,
            url: `https://github.com/${repo}/releases/download/${version}/${slug(name)}-${ext[plat]}`,
            size: (40 + rand(120)) * 1024 * 1024,
            managed: false,
            position: j,
          })),
        },
        tags: {
          create: await Promise.all(
            tags.map(async (t) => ({ tag: { connect: { id: (await db.tag.upsert({ where: { name: t }, create: { name: t }, update: {} })).id } } })),
          ),
        },
      },
    });
    for (let b = 0; b < 1 + rand(3); b++) {
      await db.clientBump.create({ data: { clientId: thisClient, userId: users[rand(users.length)].id, createdAt: new Date(now - rand(40) * 3600_000) } });
    }
  }

  // A banner, written but not live: staff publish it from the portal when they're ready.
  await db.announcement.create({
    data: {
      kind: 'BANNER',
      title: 'Bots are on the board',
      body: 'You can now list the bots you run, right alongside your servers.',
      linkUrl: '/bots',
      linkLabel: 'Browse bots',
      tone: 'accent',
      audience: 'everyone',
      active: false,
      authorId: users[0].id,
    },
  });

  // Half the servers have used /bump, so broadcasts have somewhere to go in dev.
  for (let i = 0; i < SERVERS.length; i += 2) {
    await db.server.update({ where: { id: id(i) }, data: { bumpChannelId: `chn_seed_${i}`, bumpChannelAt: new Date(now - rand(48) * 3600_000) } });
  }

  const reports = [
    [4, 'ABUSE', 'spam', 'They DM everyone who joins with an invite to another server. Got 3 messages in 10 minutes.'],
    [27, 'ABUSE', 'nsfw', 'There is an unmarked adult channel visible as soon as you join. Should be marked 18+.'],
    [27, 'ABUSE', 'nsfw', 'NSFW content in the general channel, not tagged.'],
    [21, 'ABUSE', 'scam', '“Free crypto airdrop” pinned in announcements, links to a wallet drainer.'],
    [11, 'REMOVAL', 'owner_request', 'I am the owner of this server, we are shutting it down at the end of the month. Please remove the listing.'],
    [34, 'REMOVAL', 'outdated', 'The invite link is dead and the server appears to have been deleted.'],
    [9, 'REMOVAL', 'not_owner', 'I run this server and did not list it. The person who did was banned from our server last month.'],
  ];
  for (const [i, kind, reason, details] of reports) {
    await db.report.create({
      data: { serverId: id(i), kind, reason, details, reporterId: users[(i + 3) % users.length].id, createdAt: new Date(now - rand(72) * 3600_000) },
    });
  }
  console.log(`Seeded ${SERVERS.length} servers, ${BOTS.length} bots, ${CLIENTS.length} clients, ${users.length} users, ${reports.length} reports.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
