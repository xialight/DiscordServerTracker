import { Events } from 'discord.js';
import { config } from '../config.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.get(config.guildId);
    console.log(
      guild
        ? `Tracking guild: ${guild.name} (${guild.id})`
        : `Warning: bot is not currently in the configured guild ${config.guildId}`
    );
    client.user.setActivity('/leaderboard');
  },
};
