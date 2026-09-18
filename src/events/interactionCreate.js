import { Events } from 'discord.js';
import { config } from '../config.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.guildId !== config.guildId) {
      return interaction.reply({ content: 'This bot only operates in its configured server.', ephemeral: true });
    }

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error running command "${interaction.commandName}":`, error);

      const replyData = { content: 'Something went wrong running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyData);
      } else {
        await interaction.reply(replyData);
      }
    }
  },
};
