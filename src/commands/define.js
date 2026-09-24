import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { lookupDefinition } from '../helpers/dictionary.js';

const MAX_MEANINGS = 3;
const MAX_DEFINITIONS_PER_MEANING = 2;

export default {
  data: new SlashCommandBuilder()
    .setName('define')
    .setDescription('Looks up the dictionary definition of a word.')
    .addStringOption((option) =>
      option.setName('word').setDescription('The word to define.').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const word = interaction.options.getString('word');

    let entry;
    try {
      entry = await lookupDefinition(word);
    } catch (error) {
      console.error('Dictionary lookup error:', error);
      return interaction.editReply('Dictionary lookup failed — the dictionary service may be down.');
    }

    if (!entry) {
      return interaction.editReply(`No definitions found for **${word}**.`);
    }

    // Some entries only carry pronunciation in the phonetics array (no top-level `phonetic`).
    const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text;

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(entry.word);
    if (phonetic) embed.setDescription(phonetic);

    for (const meaning of entry.meanings.slice(0, MAX_MEANINGS)) {
      const definitions = meaning.definitions
        .slice(0, MAX_DEFINITIONS_PER_MEANING)
        .map((def, i) => `${i + 1}. ${def.definition}${def.example ? `\n   _${def.example}_` : ''}`)
        .join('\n');
      embed.addFields({ name: meaning.partOfSpeech, value: definitions });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
