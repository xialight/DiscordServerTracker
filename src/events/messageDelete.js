import { Events } from 'discord.js';
import { config } from '../config.js';
import { removeMessageUsage } from '../database/statements.js';
import { isTrackedGuild } from '../helpers/utilities.js';

export default {
  name: Events.MessageDelete,
  async execute(message) {
    if (!isTrackedGuild(message.guildId, config.guildId)) return;

    try {
      removeMessageUsage(message.id);
    } catch (error) {
      console.error(`Error in ${Events.MessageDelete}:`, error);
    }
  },
};
