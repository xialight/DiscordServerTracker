import { Events } from 'discord.js';
import { config } from '../config.js';
import { recordUsage } from '../database/statements.js';
import { isTrackedGuild } from '../helpers/utilities.js';

async function ensureFullyFetched(reaction, message) {
  if (reaction.partial) await reaction.fetch();
  if (message.partial) await message.fetch();
}

export default {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    try {
      const { message } = reaction;
      if (!isTrackedGuild(message.guildId, config.guildId)) return;
      if (!reaction.emoji.id) return; // unicode emoji, nothing server-exclusive to track
      if (user.bot) return;

      await ensureFullyFetched(reaction, message);

      const guildEmoji = message.guild.emojis.cache.get(reaction.emoji.id);
      if (!guildEmoji) return; // emoji isn't from this server

      const createdAt = Math.floor(Date.now() / 1000);

      recordUsage({
        kind: 'emoji',
        action: 'reaction_sent',
        itemId: guildEmoji.id,
        itemName: guildEmoji.name,
        animated: guildEmoji.animated,
        userId: user.id,
        messageId: message.id,
        createdAt,
      });

      if (message.author && message.author.id !== user.id) {
        recordUsage({
          kind: 'emoji',
          action: 'reaction_received',
          itemId: guildEmoji.id,
          itemName: guildEmoji.name,
          animated: guildEmoji.animated,
          userId: message.author.id,
          actorId: user.id,
          messageId: message.id,
          createdAt,
        });
      }
    } catch (error) {
      console.error(`Error in ${Events.MessageReactionAdd}:`, error);
    }
  },
};
