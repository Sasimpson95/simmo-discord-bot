# Simmo AOE4 Discord Bot — V1.3

Discord bot for Simmo's content and Age of Empires IV record:

- `@simmo7519` YouTube upload notifications
- `siimmoo` Twitch live notifications
- Automatic Age of Empires IV match detection through AoE4World
- W/L record, win rate, current streak and best win streak
- Optional Discord post after every newly detected match
- Manual `/win` and `/loss` remain as backup corrections
- Clear startup health messages every time the bot starts

The AoE4World profile is preconfigured as **17089962**.

## Discord commands

- `/record` — show the current automatically tracked record
- `/win` — manually add a win (backup/correction)
- `/loss` — manually add a loss (backup/correction)
- `/reset-record confirm:true` — reset the displayed record without re-importing old matches

## Startup health display

Every time `npm start` is run, V1.3 now confirms each watcher after its first check. A healthy startup looks like:

```text
Logged in as Simmo Bot#2073
Starting watchers...

✅ YouTube watcher running — @simmo7519 — every 5 min
✅ Twitch watcher running — siimmoo — every 60 sec
✅ AoE4World watcher running — profile 17089962 — rm_solo — every 2 min

🤖 All systems running
```

If an API check fails, that watcher displays `❌ failed` and the error is printed above it, while Discord can remain online.

## AoE4World tracking modes

By default the bot tracks Ranked Solo only:

```env
AOE4WORLD_LEADERBOARD=rm_solo
```

You can also track all public game modes returned for the AoE4World profile by using:

```env
AOE4WORLD_LEADERBOARD=all
```

When set to `all`, the bot does not send a leaderboard filter to AoE4World, so it can detect public matches across the player's available game history rather than Ranked Solo only.

You can also choose a specific supported mode, for example:

```env
AOE4WORLD_LEADERBOARD=rm_team
AOE4WORLD_LEADERBOARD=qm_1v1
AOE4WORLD_LEADERBOARD=qm_2v2
AOE4WORLD_LEADERBOARD=qm_3v3
AOE4WORLD_LEADERBOARD=qm_4v4
```

Private games may require an AoE4World API key and are not included by this bot.

## First-run behaviour

On the first startup with a fresh `data/state.json`, the bot checks existing AoE4World match history and marks those games as already seen. It does not silently add old matches to the Discord record.

From then onward, newly completed matches are detected automatically. By default the bot checks every 2 minutes.

## `.env` layout

```env
DISCORD_TOKEN=YOUR_BOT_TOKEN
DISCORD_CLIENT_ID=YOUR_APPLICATION_ID
DISCORD_GUILD_ID=YOUR_SERVER_ID
DISCORD_ALERT_CHANNEL_ID=YOUR_ALERT_CHANNEL_ID

YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY
YOUTUBE_HANDLE=@simmo7519
YOUTUBE_CHECK_INTERVAL_MS=300000

TWITCH_CLIENT_ID=YOUR_TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET=YOUR_TWITCH_CLIENT_SECRET
TWITCH_CHANNEL=siimmoo
TWITCH_CHECK_INTERVAL_MS=60000

AOE4WORLD_PROFILE_ID=17089962
AOE4WORLD_LEADERBOARD=rm_solo
AOE4WORLD_CHECK_INTERVAL_MS=120000
AOE4WORLD_POST_MATCH_RESULTS=true

POST_STARTUP_MESSAGE=false
```

Never upload `.env` to GitHub.

## Upgrade from V1.2

1. Stop the old bot with `Ctrl + C`.
2. Extract the V1.3 ZIP to a new folder.
3. Copy your existing `.env` from V1.2 into the V1.3 folder.
4. If you want to preserve the already-seen match list and current record, copy `data/state.json` from V1.2 into the V1.3 `data` folder.
5. Open PowerShell in V1.3.
6. Run `npm install`.
7. Run `npm start`.
8. Confirm all three watcher lines show `✅`.

You do not need to run `npm run register` because the slash command names have not changed.

## Hosting note

The bot currently runs only while the Node process is running. For true automatic 24/7 monitoring, deploy it to a host with a persistent process and persistent storage, or move the state to a hosted database such as Supabase.


## V1.4 commands

- `/commands` — show all bot commands
- `/random` — pick a random current Age of Empires IV civilization
