import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { braveWebSearch } from '../helpers/braveSearch.js';

const RESULT_COUNT = 5;
const MAX_DESCRIPTION_LENGTH = 200;
// Result titles/descriptions come from arbitrary web content, so strip Markdown
// control characters before dropping them into an embed to avoid broken formatting.
const MARKDOWN_CHARS_REGEX = /[*_~`|]/g;

function sanitize(text) {
  return text.replace(MARKDOWN_CHARS_REGEX, '');
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export default {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Searches the web (via Brave Search).')
    .addStringOption((option) =>
      option.setName('query').setDescription('What to search for.').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');

    let results;
    try {
      results = await braveWebSearch(query, RESULT_COUNT);
    } catch (error) {
      console.error('Brave Search error:', error);
      return interaction.editReply('Search failed — the search provider may be down or rate-limited.');
    }

    if (!results.length) {
      return interaction.editReply(`No results found for **${sanitize(query)}**.`);
    }

    const embed = new EmbedBuilder()
      .setColor(0xfb542b)
      .setTitle(`Search results for "${sanitize(query)}"`)
      .setDescription(
        results
          .map(
            (result) =>
              `**${sanitize(result.title)}**\n${result.url}\n${truncate(sanitize(result.description), MAX_DESCRIPTION_LENGTH)}`
          )
          .join('\n\n')
      )
      .setFooter({ text: 'Results via Brave Search' });

    await interaction.editReply({ embeds: [embed] });
  },
};
