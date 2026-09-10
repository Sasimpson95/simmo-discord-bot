import 'dotenv/config';
import {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { loadState, saveState, updateState } from './store.js';
import { resolveChannel, getLatestUpload } from './youtube.js';
import { getCurrentTwitchStream } from './twitch.js';
import { getRecentPlayerGames, summarizeGame, gameSortTime } from './aoe4world.js';

const required = [
  'DISCORD_TOKEN',
  'DISCORD_ALERT_CHANNEL_ID',
  'YOUTUBE_API_KEY',
  'YOUTUBE_HANDLE',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'TWITCH_CHANNEL',
  'AOE4WORLD_PROFILE_ID'
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const youtubeIntervalMs = Number(process.env.YOUTUBE_CHECK_INTERVAL_MS || 300000);
const twitchIntervalMs = Number(process.env.TWITCH_CHECK_INTERVAL_MS || 60000);
const aoe4worldIntervalMs = Number(process.env.AOE4WORLD_CHECK_INTERVAL_MS || 120000);
const aoe4worldProfileId = String(process.env.AOE4WORLD_PROFILE_ID);
const aoe4worldLeaderboardSetting = (process.env.AOE4WORLD_LEADERBOARD || 'rm_solo').trim().toLowerCase();
const aoe4worldLeaderboard = aoe4worldLeaderboardSetting === 'all' ? null : aoe4worldLeaderboardSetting;
const postMatchResults = String(process.env.AOE4WORLD_POST_MATCH_RESULTS ?? 'true').toLowerCase() === 'true';
let youtubeCheckRunning = false;
let twitchCheckRunning = false;
let aoe4worldCheckRunning = false;

function recordText(aoe4) {
  const total = aoe4.wins + aoe4.losses;
  const winRate = total ? ((aoe4.wins / total) * 100).toFixed(1) : '0.0';
  const streak = aoe4.currentStreak > 0
    ? `🔥 ${aoe4.currentStreak} win streak`
    : aoe4.currentStreak < 0
      ? `${Math.abs(aoe4.currentStreak)} loss streak`
      : 'No active streak';
  return `**${aoe4.wins}W – ${aoe4.losses}L** • ${winRate}% win rate • ${streak}\nBest win streak: **${aoe4.bestWinStreak}**`;
}

function applyResult(state, result) {
  if (result === 'win') {
    state.aoe4.wins += 1;
    state.aoe4.currentStreak = state.aoe4.currentStreak >= 0 ? state.aoe4.currentStreak + 1 : 1;
    state.aoe4.bestWinStreak = Math.max(state.aoe4.bestWinStreak, state.aoe4.currentStreak);
  } else if (result === 'loss') {
    state.aoe4.losses += 1;
    state.aoe4.currentStreak = state.aoe4.currentStreak <= 0 ? state.aoe4.currentStreak - 1 : -1;
  }
  state.aoe4.lastResult = result;
  state.aoe4.updatedAt = new Date().toISOString();
}

async function alertChannel() {
  const channel = await client.channels.fetch(process.env.DISCORD_ALERT_CHANNEL_ID);
  if (!channel?.isTextBased()) throw new Error('DISCORD_ALERT_CHANNEL_ID is not a text channel.');
  return channel;
}

async function checkYouTube() {
  if (youtubeCheckRunning) return;
  youtubeCheckRunning = true;
  try {
    const state = loadState();

    if (!state.youtube.channelId || !state.youtube.uploadsPlaylistId) {
      const channel = await resolveChannel(process.env.YOUTUBE_HANDLE, process.env.YOUTUBE_API_KEY);
      state.youtube.channelId = channel.channelId;
      state.youtube.uploadsPlaylistId = channel.uploadsPlaylistId;
      saveState(state);
      console.log(`YouTube channel resolved: ${channel.title} (${channel.channelId})`);
    }

    const latest = await getLatestUpload(state.youtube.uploadsPlaylistId, process.env.YOUTUBE_API_KEY);
    const channel = await alertChannel();

    if (!state.youtube.initialized) {
      state.youtube.lastVideoId = latest?.videoId ?? null;
      state.youtube.initialized = true;
      saveState(state);
      console.log('YouTube watcher initialized. Existing uploads will not be reposted.');
      return true;
    }

    if (latest?.videoId && latest.videoId !== state.youtube.lastVideoId) {
      const embed = new EmbedBuilder()
        .setTitle('📺 New YouTube upload!')
        .setDescription(`**${latest.title}**\n\n[Watch on YouTube](${latest.url})`)
        .setURL(latest.url)
        .setTimestamp(new Date(latest.publishedAt || Date.now()));
      if (latest.thumbnail) embed.setImage(latest.thumbnail);
      await channel.send({ content: '@here New video is up!', embeds: [embed] });
      state.youtube.lastVideoId = latest.videoId;
      saveState(state);
    }
  } catch (error) {
    console.error('YouTube check failed:', error.message);
    return false;
  } finally {
    youtubeCheckRunning = false;
  }
  return true;
}

async function checkTwitch() {
  if (twitchCheckRunning) return;
  twitchCheckRunning = true;
  try {
    const state = loadState();

    const live = await getCurrentTwitchStream(
      process.env.TWITCH_CHANNEL,
      process.env.TWITCH_CLIENT_ID,
      process.env.TWITCH_CLIENT_SECRET
    );

    if (!state.twitch.initialized) {
      state.twitch.activeStreamId = live?.streamId ?? null;
      state.twitch.initialized = true;
      saveState(state);
      console.log('Twitch watcher initialized.');
      return true;
    }

    if (live?.streamId && live.streamId !== state.twitch.activeStreamId) {
      const channel = await alertChannel();
      const current = loadState().aoe4;
      const embed = new EmbedBuilder()
        .setTitle('🔴 SIIMMOO IS LIVE')
        .setDescription(
          `**${live.title}**\n` +
          `🎮 ${live.gameName}\n\n` +
          `${recordText(current)}\n\n` +
          `[Watch live on Twitch](${live.url})`
        )
        .setURL(live.url)
        .setTimestamp(new Date(live.startedAt || Date.now()));
      if (live.thumbnail) embed.setImage(live.thumbnail);
      await channel.send({ content: '@here Live now on Twitch!', embeds: [embed] });
      state.twitch.activeStreamId = live.streamId;
      saveState(state);
    }

    if (!live && state.twitch.activeStreamId) {
      state.twitch.activeStreamId = null;
      saveState(state);
    }
  } catch (error) {
    console.error('Twitch check failed:', error.message);
    return false;
  } finally {
    twitchCheckRunning = false;
  }
  return true;
}

async function sendMatchResult(summary, aoe4) {
  if (!postMatchResults) return;
  const channel = await alertChannel();
  const won = summary.result === 'win';
  const details = [
    summary.civilization ? `Civilization: **${summary.civilization}**` : null,
    summary.opponentNames ? `Opponent: **${summary.opponentNames}**` : null,
    summary.map ? `Map: **${summary.map}**` : null
  ].filter(Boolean).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(won ? '🏆 Age IV — WIN' : '💀 Age IV — LOSS')
    .setDescription(`${details}\n\n${recordText(aoe4)}\n\n[View match on AoE4World](${summary.url})`)
    .setURL(summary.url)
    .setTimestamp(summary.startedAt ? new Date(summary.startedAt) : new Date());

  await channel.send({ embeds: [embed] });
}

async function checkAoE4World() {
  if (aoe4worldCheckRunning) return;
  aoe4worldCheckRunning = true;
  try {
    const state = loadState();

    // First run only seeds existing matches. We start the bot's record from this point forward,
    // so old matches on the profile are not silently added to the Discord record.
    if (!state.aoe4world.initialized) {
      const seedGames = await getRecentPlayerGames(aoe4worldProfileId, {
        leaderboard: aoe4worldLeaderboard,
        limit: 20
      });
      state.aoe4world.processedGameIds = seedGames
        .map(game => summarizeGame(game, aoe4worldProfileId))
        .filter(game => game.gameId && game.result)
        .map(game => game.gameId)
        .slice(0, 100);
      state.aoe4world.initialized = true;
      state.aoe4world.lastSyncAt = new Date().toISOString();
      saveState(state);
      console.log(`AoE4World watcher initialized for profile ${aoe4worldProfileId}. Existing games will not be counted.`);
      return true;
    }

    const since = state.aoe4world.lastSyncAt
      ? new Date(Date.parse(state.aoe4world.lastSyncAt) - 60_000).toISOString()
      : new Date(Date.now() - 10 * 60_000).toISOString();

    const games = await getRecentPlayerGames(aoe4worldProfileId, {
      leaderboard: aoe4worldLeaderboard,
      since,
      limit: 50
    });

    const processed = new Set(state.aoe4world.processedGameIds ?? []);
    const newCompleted = games
      .sort((a, b) => gameSortTime(a) - gameSortTime(b))
      .map(game => summarizeGame(game, aoe4worldProfileId))
      .filter(game => game.gameId && game.result && !processed.has(game.gameId));

    for (const game of newCompleted) {
      applyResult(state, game.result);
      processed.add(game.gameId);
      state.aoe4world.processedGameIds = [...processed].slice(-200);
      saveState(state);
      console.log(`AoE4World match ${game.gameId}: ${game.result.toUpperCase()} -> ${state.aoe4.wins}W-${state.aoe4.losses}L`);
      await sendMatchResult(game, state.aoe4);
    }

    state.aoe4world.processedGameIds = [...processed].slice(-200);
    state.aoe4world.lastSyncAt = new Date().toISOString();
    saveState(state);
  } catch (error) {
    console.error('AoE4World check failed:', error.message);
    return false;
  } finally {
    aoe4worldCheckRunning = false;
  }
  return true;
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  if (String(process.env.POST_STARTUP_MESSAGE).toLowerCase() === 'true') {
    try {
      const channel = await alertChannel();
      await channel.send('✅ Simmo AOE4 bot is online.');
    } catch (error) {
      console.error('Could not post startup message:', error.message);
    }
  }
  console.log('Starting watchers...');
  const [youtubeOk, twitchOk, aoe4worldOk] = await Promise.all([
    checkYouTube(),
    checkTwitch(),
    checkAoE4World()
  ]);

  console.log('');
  console.log(`${youtubeOk ? '✅' : '❌'} YouTube watcher ${youtubeOk ? 'running' : 'failed'} — ${process.env.YOUTUBE_HANDLE} — every ${Math.round(youtubeIntervalMs / 60000)} min`);
  console.log(`${twitchOk ? '✅' : '❌'} Twitch watcher ${twitchOk ? 'running' : 'failed'} — ${process.env.TWITCH_CHANNEL} — every ${Math.round(twitchIntervalMs / 1000)} sec`);
  console.log(`${aoe4worldOk ? '✅' : '❌'} AoE4World watcher ${aoe4worldOk ? 'running' : 'failed'} — profile ${aoe4worldProfileId} — ${aoe4worldLeaderboard ? aoe4worldLeaderboard : 'all public game modes'} — every ${Math.round(aoe4worldIntervalMs / 60000)} min`);
  console.log('');
  console.log(youtubeOk && twitchOk && aoe4worldOk ? '🤖 All systems running' : '⚠️ Bot is online, but one or more watchers need attention');

  setInterval(checkYouTube, youtubeIntervalMs);
  setInterval(checkTwitch, twitchIntervalMs);
  setInterval(checkAoE4World, aoe4worldIntervalMs);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'record') {
    const { aoe4 } = loadState();
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚔️ Age of Empires IV Record')
          .setDescription(`${recordText(aoe4)}\n\n*Auto-tracked from AoE4World profile ${aoe4worldProfileId}.*`)
      ]
    });
    return;
  }

  if (interaction.commandName === 'win') {
    const state = updateState(s => applyResult(s, 'win'));
    await interaction.reply(`🏆 **Manual WIN added!**\n${recordText(state.aoe4)}`);
    return;
  }

  if (interaction.commandName === 'loss') {
    const state = updateState(s => applyResult(s, 'loss'));
    await interaction.reply(`💀 **Manual loss added.**\n${recordText(state.aoe4)}`);
    return;
  }

  if (interaction.commandName === 'reset-record') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Only members with **Manage Server** can reset the record.', ephemeral: true });
      return;
    }
    if (!interaction.options.getBoolean('confirm')) {
      await interaction.reply({ content: 'Reset cancelled.', ephemeral: true });
      return;
    }
    const state = loadState();
    state.aoe4 = {
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestWinStreak: 0,
      lastResult: null,
      updatedAt: new Date().toISOString()
    };
    // Keep already-processed AoE4World match IDs so a reset does not immediately re-add old games.
    saveState(state);
    await interaction.reply('♻️ **Age of Empires IV record reset to 0–0.** New AoE4World matches will continue tracking automatically.');
  }
});

client.login(process.env.DISCORD_TOKEN);
