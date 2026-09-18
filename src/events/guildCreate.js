import { Events } from 'discord.js';
import { config } from '../config.js';

export default {
  name: Events.GuildCreate,
  async execute(guild) {
    if (guild.id !== config.guildId) {
      console.warn(`Joined unauthorized guild "${guild.name}" (${guild.id}); leaving.`);
      await guild.leave().catch(console.error);
    }
  },
};
