# Discord Server Tracker

A Discord bot that tracks custom emoji and sticker usage **exclusively** for one configured server. Provides all-time, weekly, and daily leaderboards, both server-wide and per-user.

## How it works

- Listens to `messageCreate`, `messageReactionAdd`/`Remove`, and `messageDelete` for the one guild set as `GUILD_ID`. Events from any other guild are ignored, and if the bot is ever added to a different server it leaves automatically.
- Every emoji/sticker use is checked against that guild's own emoji/sticker cache — emotes from other servers (e.g. typed via Nitro) are never recorded.
- Usage is stored as individual timestamped rows in a local SQLite database (`better-sqlite3`), so daily/weekly/all-time leaderboards are just a `created_at` range filter — no separate rollup tables needed.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `BOT_TOKEN` — from the Discord Developer Portal
   - `CLIENT_ID` — your application's client ID
   - `GUILD_ID` — the ID of the one server to track
   - `DB_PATH` — optional, defaults to `./data/tracker.db`
3. In the Developer Portal, enable the **Message Content Intent** and **Server Members Intent** for the bot.
4. Invite the bot to your server with the `bot` and `applications.commands` scopes and at minimum `View Channel`, `Send Messages`, and `Read Message History` permissions.
5. Register slash commands (guild-scoped, so they show up instantly): `npm run deploy`
6. Start the bot: `npm start`

For always-on hosting on a VPS, run it under a process manager, e.g.:

```
pm2 start src/index.js --name discord-server-tracker --interpreter node
```

## Commands

- `/leaderboard board:<Emojis|Stickers|Users (Emojis)|Users (Stickers)> [range] [order:Most used|Least used]` — paginated server-wide leaderboards (Prev/Next buttons). Emoji and sticker boards list every emoji/sticker the server currently has, including unused ones at 0, so `Least used` is the way to find candidates to delete.
- `/stats [user] [range]` — a user's (or your own) personal top emojis and stickers.
- `/emoji-leaderboard emoji:<emoji> [direction:Sent|Received] [range]` — who uses (or gets reactions with) a specific emoji the most.

`range` is `Daily`, `Weekly`, or `All-Time` (default) on every command.

## Data model

Single `usage` table, one row per emoji/sticker event:

| column | notes |
| --- | --- |
| `kind` | `emoji` or `sticker` |
| `action` | `message`, `reaction_sent`, or `reaction_received` (stickers are always `message`) |
| `item_id` / `item_name` | the emoji/sticker's Discord ID and name at time of use |
| `user_id` | who gets credited |
| `message_id` | used to clean up rows if a message or reaction is removed |
| `created_at` | unix seconds, indexed for range queries |
