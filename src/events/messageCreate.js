import { Events } from 'discord.js';
import { config } from '../config.js';
import { incrementWordCounts, recordUsage } from '../database/statements.js';
import { extractCustomEmojiIds, getUtcDayString, isTrackedGuild } from '../helpers/utilities.js';
import { extractWords } from '../helpers/wordFilter.js';

function processEmojis(message) {
  const matches = extractCustomEmojiIds(message.content);
  if (!matches.length) return;

  const guildEmojis = message.guild.emojis.cache;
  const createdAt = Math.floor(message.createdTimestamp / 1000);

  for (const { id, animated } of matches) {
    const emoji = guildEmojis.get(id);
    if (!emoji) continue; // not one of this server's emojis

    recordUsage({
      kind: 'emoji',
      action: 'message',
      itemId: emoji.id,
      itemName: emoji.name,
      animated,
      userId: message.author.id,
      messageId: message.id,
      createdAt,
    });
  }
}

function processStickers(message) {
  if (!message.stickers.size) return;

  const guildStickers = message.guild.stickers.cache;
  const createdAt = Math.floor(message.createdTimestamp / 1000);

  for (const sticker of message.stickers.values()) {
    if (!guildStickers.has(sticker.id)) continue; // not one of this server's stickers

    recordUsage({
      kind: 'sticker',
      action: 'message',
      itemId: sticker.id,
      itemName: sticker.name,
      animated: 0,
      userId: message.author.id,
      messageId: message.id,
      createdAt,
    });
  }
}

function processWords(message) {
  const words = extractWords(message.content);
  incrementWordCounts(words, getUtcDayString());
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (!isTrackedGuild(message.guildId, config.guildId)) return;
    if (message.author?.bot || message.webhookId) return;

    try {
      processEmojis(message);
      processStickers(message);
      processWords(message);
    } catch (error) {
      console.error(`Error in ${Events.MessageCreate}:`, error);
    }
  },
};
