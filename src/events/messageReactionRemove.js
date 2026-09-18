import { Events } from 'discord.js';
import { config } from '../config.js';
import { removeReactionUsage } from '../database/statements.js';
import { isTrackedGuild } from '../helpers/utilities.js';

export default {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    try {
      const { message } = reaction;
      if (!isTrackedGuild(message.guildId, config.guildId)) return;
      if (!reaction.emoji.id) return;
      if (user.bot) return;

      if (reaction.partial) await reaction.fetch().catch(() => null);
      if (message.partial) await message.fetch().catch(() => null);

      removeReactionUsage({
        itemId: reaction.emoji.id,
        userId: user.id,
        messageId: message.id,
        action: 'reaction_sent',
      });

      if (message.author && message.author.id !== user.id) {
        removeReactionUsage({
          itemId: reaction.emoji.id,
          userId: message.author.id,
          messageId: message.id,
          action: 'reaction_received',
        });
      }
    } catch (error) {
      console.error(`Error in ${Events.MessageReactionRemove}:`, error);
    }
  },
};
