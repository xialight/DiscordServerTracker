// Standard English stopwords. Deliberately excludes chat slang (lol, lmao, ngl, etc.)
// since that's exactly the "fun" content a word cloud should surface.
const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before
  being below between both but by can't cannot could couldn't did didn't do does doesn't doing
  don't down during each few for from further had hadn't has hasn't have haven't having he he'd
  he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in
  into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on
  once only or other ought our ours ourselves out over own same shan't she she'd she'll she's
  should shouldn't so some such than that that's the their theirs them themselves then there
  there's these they they'd they'll they're they've this those through to too under until up
  very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's
  which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've
  your yours yourself yourselves`
    .split(/\s+/)
    .filter(Boolean)
);

const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;
const INLINE_CODE_REGEX = /`[^`]*`/g;
const URL_REGEX = /(https?:\/\/\S+|www\.\S+)/gi;
const MENTION_REGEX = /<@!?\d+>|<@&\d+>|<#\d+>/g;
const CUSTOM_EMOJI_REGEX = /<a?:\w{2,32}:\d{17,20}>/g;
const MARKDOWN_CHARS_REGEX = /[*_~`>|]/g;
const TOKEN_SPLIT_REGEX = /[^a-z0-9'-]+/;

// Messages starting with one of these are almost always directed at a bot, not conversation.
const COMMAND_PREFIXES = new Set(['!', '?', '.', '/', '-', '$', '%', '~', ';', '>', '+', '=', '&']);

const MIN_WORD_LENGTH = 3;

function isLikelyCommand(content) {
  return COMMAND_PREFIXES.has(content[0]);
}

function tokenize(content) {
  const cleaned = content
    .replace(CODE_BLOCK_REGEX, ' ')
    .replace(INLINE_CODE_REGEX, ' ')
    .replace(URL_REGEX, ' ')
    .replace(MENTION_REGEX, ' ')
    .replace(CUSTOM_EMOJI_REGEX, ' ')
    .replace(MARKDOWN_CHARS_REGEX, ' ')
    .toLowerCase();

  const words = [];
  for (const raw of cleaned.split(TOKEN_SPLIT_REGEX)) {
    const word = raw.replace(/^[-']+|[-']+$/g, '');
    if (word.length < MIN_WORD_LENGTH) continue;
    if (/^\d+$/.test(word)) continue;
    if (STOPWORDS.has(word)) continue;
    words.push(word);
  }
  return words;
}

// Bot/webhook filtering and empty-content checks are the caller's responsibility
// (messageCreate already skips those before this runs).
export function extractWords(content) {
  const trimmed = content?.trim();
  if (!trimmed) return [];
  if (isLikelyCommand(trimmed)) return [];

  // A word counts once per message no matter how many times it's repeated,
  // same principle as emoji/sticker usage: one spammed message shouldn't
  // outweigh several different people each saying it once.
  return [...new Set(tokenize(trimmed))];
}
