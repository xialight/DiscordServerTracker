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
- `/wordcloud range:<Daily|Weekly>` — an image of the server's most common chat words.

`range` is `Daily`, `Weekly`, or `All-Time` (default) on the leaderboard/stats commands; `/wordcloud` only offers `Daily`/`Weekly` (see below for why).

## Data model

Single `usage` table, one row per emoji/sticker event:

| column | notes |
| --- | --- |
| `kind` | `emoji` or `sticker` |
| `action` | `message`, `reaction_sent`, or `reaction_received` (stickers are always `message`) |
| `item_id` / `item_name` | the emoji/sticker's Discord ID and name at time of use |
| `user_id` | who gets credited |
| `actor_id` | for `reaction_received` rows, who reacted (so each reactor is counted and removed separately); empty otherwise |
| `message_id` | used to clean up rows if a message or reaction is removed |
| `created_at` | unix seconds, indexed for range queries |

Each emoji/sticker counts at most once per message (and once per user per reaction), enforced by a unique index on `(kind, action, item_id, user_id, message_id, actor_id)` — spamming the same emote 50 times in one message still counts as 1.

## Word cloud

`/wordcloud` is built to never retain raw message text or per-user data. As each message comes in, it's tokenized in memory and only a `(word, day, count)` counter is incremented in a separate `word_counts` table — there's no message ID or user ID attached to a word, so the data at rest can't be traced back to who said what. Counters older than 9 days are deleted automatically on every bot startup, which is also why `/wordcloud` only offers Daily/Weekly ranges — there's no "all-time" data to query.

Before counting, a message is skipped entirely if:
- it's from a bot or a webhook
- its content is empty after trimming (covers embed-only, attachment-only, and sticker-only messages, since embeds are never read)
- it starts with a common bot-command prefix character (`!`, `.`, `/`, `?`, `-`, `$`, `%`, `~`, `;`, `>`, `+`, `=`, `&`)

Within a message that passes, these are stripped before splitting into words: code blocks, inline code, URLs (`http(s)://...`, `www...`), `@user`/`@role`/`#channel` mentions, custom emoji codes, and Markdown formatting characters. Remaining tokens under 3 characters, pure numbers, and standard English stopwords (the, a, is, and, ...) are dropped — chat slang like "lol"/"lmao"/"ngl" is intentionally kept, since that's exactly what makes it fun. Tokenizing is ASCII-only, so accented/non-English words will get split on the accented characters.

The image itself is rendered server-side with `@napi-rs/canvas` — no external API calls. Layout is a small hand-rolled placement in [wordcloudImage.js](src/helpers/wordcloudImage.js): biggest words are placed first, each searching an outward spiral (from a randomized start angle, so words don't all settle along the same few radial arms) for the first spot that doesn't collide with an already-placed word, checked with exact rectangle math (not pixel sampling). An earlier version used the `d3-cloud` package, but its collision detection is pixel-mask based and gets coarser for larger glyphs, which produced real, if intermittent, overlapping words — worse the bigger and more skewed the word sizes were. Rotation is also disabled (every word draws horizontally), since that made the old library's overlap problem worse and doesn't add much for a chat word cloud anyway.

Font size is scaled from count by square root, not linearly — a copypasta or in-joke spammed a few hundred times in a day would otherwise stretch a linear scale so far that every normal word gets crushed down near the minimum size.
