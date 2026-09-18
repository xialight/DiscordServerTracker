export const RANGE_CHOICES = [
  { name: 'Daily', value: 'daily' },
  { name: 'Weekly', value: 'weekly' },
  { name: 'All-Time', value: 'alltime' },
];

export function rangeToSince(range) {
  const now = Math.floor(Date.now() / 1000);
  switch (range) {
    case 'daily':
      return { since: now - 86400, label: 'Daily' };
    case 'weekly':
      return { since: now - 7 * 86400, label: 'Weekly' };
    default:
      return { since: 0, label: 'All-Time' };
  }
}

const EMOJI_REGEX = /<a?:\w{2,32}:(\d{17,20})>/g;

export function extractCustomEmojiIds(content) {
  if (!content) return [];
  return [...content.matchAll(EMOJI_REGEX)].map((match) => ({
    id: match[1],
    animated: match[0].startsWith('<a:'),
  }));
}

export function isTrackedGuild(guildId, configGuildId) {
  return guildId === configGuildId;
}
