import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getWordCounts } from '../database/statements.js';
import { getDayRange } from '../helpers/utilities.js';
import { renderWordCloud } from '../helpers/wordcloudImage.js';

const MIN_WORDS_REQUIRED = 5;
const MAX_WORDS_RENDERED = 120;

export default {
  data: new SlashCommandBuilder()
    .setName('wordcloud')
    .setDescription("Shows a word cloud of the server's chat activity.")
    .addStringOption((option) =>
      option
        .setName('range')
        .setDescription('The time range to build the cloud from.')
        .setRequired(true)
        .addChoices({ name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' })
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const range = interaction.options.getString('range');
    const days = getDayRange(range);
    const rows = getWordCounts({ days, limit: MAX_WORDS_RENDERED });

    if (rows.length < MIN_WORDS_REQUIRED) {
      return interaction.editReply('Not enough chat activity in that range yet to build a word cloud.');
    }

    const buffer = await renderWordCloud(rows);
    const attachment = new AttachmentBuilder(buffer, { name: 'wordcloud.png' });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${range === 'weekly' ? 'Weekly' : 'Daily'} Word Cloud — ${interaction.guild.name}`)
      .setImage('attachment://wordcloud.png');

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  },
};
