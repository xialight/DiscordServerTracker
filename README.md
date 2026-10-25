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
   - `GEMINI_API_KEY` — for `/search`; get one free at [aistudio.google.com](https://aistudio.google.com/apikey)
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
- `/search query:<text>` — an AI-generated overview answer, grounded in real Google Search results via the Gemini API.
- `/define word:<word>` — dictionary definition via the free [dictionaryapi.dev](https://dictionaryapi.dev), no key required.

`range` is `Daily`, `Weekly`, or `All-Time` (default) on the leaderboard/stats commands; `/wordcloud` only offers `Daily`/`Weekly` (see below for why).

`/search` and `/define` don't touch the database at all — no queries are logged or stored, they're just a live proxy to their respective APIs.

Both requests go through [httpRetry.js](src/helpers/httpRetry.js): a 15s timeout per attempt, one retry on a timeout or 5xx response, no retry on 4xx (a real "not found" won't change on retry, so it fails fast). This exists because dictionaryapi.dev's free tier is genuinely slow/flaky sometimes — observed both a request that took 15+ seconds and a Cloudflare `522` origin timeout on lookups during testing.

### `/search` implementation note

`/search` calls the Gemini API's `POST /v1beta/interactions` endpoint with the `google_search` tool enabled, so answers are grounded in real, current Google Search results rather than the model's training data alone. The answer text is read from the response's `output_text` convenience field, with a fallback that walks the `steps` array for a `model_output` step's content if that field is ever missing.

Model choice matters here, and this went through two rounds of trial and error:

1. `gemini-3.8-flash` (Google's own grounding-docs example model) is capped at **5 requests/minute, 20/day** on a free-tier key — the `google_search` tool apparently draws from that tight base quota rather than the separate, much larger (5,000/month) grounding-specific quota, so a `429` showed up almost immediately in production.
2. Switched to `gemini-3.1-flash-lite` (15 RPM / 500 RPD on the same account, and cheaper per-token) to fix that — but after billing was enabled on the key (which does fix the `429`s), requests to that model started failing with `400 Bad Request`. Gemini's own `google_search` docs only ever show `gemini-3.8-flash` as a working example; flash-lite's tool support was never actually confirmed, and the earlier `429`s likely masked a "this model doesn't support that tool" validation failure that only surfaces once the free-tier rate gate is out of the way.

Reverted to `gemini-3.8-flash` for reliability now that billing being enabled means its free-tier rate limit no longer applies. If cost becomes a concern again, a cheaper model should be verified to support the `google_search` tool (e.g. by checking the error body from a real `400` response, which [gemini.js](src/helpers/gemini.js) now logs in full) before swapping again, rather than assumed.

3. Next, requests started timing out instead of failing outright, consistently (every attempt, not intermittently). Two possible causes: (a) grounded search (live Google queries, page retrieval, then synthesis) is just slower than the lightweight calls [httpRetry.js](src/helpers/httpRetry.js)'s 15s default was tuned for, since the request type failing at the same fixed threshold every time is actually consistent with that; or (b) the Interactions API defaulting to a streaming response we weren't consuming as one, since `stream` was never set explicitly — a migration guide's "streaming is opt-in via `stream: true`" wording suggests this probably isn't it, but it's cheap to rule out. `/search` now explicitly sends `"stream": false`, uses a 45s timeout instead of 15s (no real cost to this, since Discord tolerates up to 15 minutes between deferring and editing a reply), and logs how long the request actually took on both success and failure — so the next attempt's logs should show real data instead of more guessing.

This replaced two earlier, more expensive attempts: a Brave Search top-5-results list (took up too much of the channel) and then Brave's **Answers** product (a separate paid product from Brave's plain Search plan, priced per-query plus opaque token costs that added up to several dollars a day). Gemini's Google Search grounding gives a generous free monthly quota before any per-request charge, and Flash-family models have their own free tier for the token costs on top of that — likely at or near $0/month for a single server's usage, and meaningfully cheaper than Brave even beyond any free tier.

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

Within a message that passes, these are stripped before splitting into words: code blocks, inline code, URLs (`http(s)://...`, `www...`), `@user`/`@role`/`#channel` mentions, custom emoji codes, and Markdown formatting characters. Remaining tokens under 3 characters, pure numbers, and standard English stopwords (the, a, is, and, ...) are dropped — chat slang like "lol"/"lmao"/"ngl" is intentionally kept, since that's exactly what makes it fun. Tokenizing is ASCII-only, so accented/non-English words will get split on the accented characters. A word counts at most once per message no matter how many times it's repeated in it — same anti-spam principle as emoji/sticker usage.

The image itself is rendered server-side with `@napi-rs/canvas` — no external API calls. Layout is a small hand-rolled placement in [wordcloudImage.js](src/helpers/wordcloudImage.js): biggest words are placed first, each searching an outward spiral (from a randomized start angle, so words don't all settle along the same few radial arms) for the first spot that doesn't collide with an already-placed word, checked with exact rectangle math (not pixel sampling). An earlier version used the `d3-cloud` package, but its collision detection is pixel-mask based and gets coarser for larger glyphs, which produced real, if intermittent, overlapping words — worse the bigger and more skewed the word sizes were. Rotation is also disabled (every word draws horizontally), since that made the old library's overlap problem worse and doesn't add much for a chat word cloud anyway.

Font size is scaled from count by square root, not linearly — a copypasta or in-joke spammed a few hundred times in a day would otherwise stretch a linear scale so far that every normal word gets crushed down near the minimum size.
