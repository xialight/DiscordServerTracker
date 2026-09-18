import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getItemLeaderboard } from '../database/statements.js';
import { rangeToSince, RANGE_CHOICES } from '../helpers/utilities.js';

const EMOJI_INPUT_REGEX = /<a?:\w{2,32}:(\d{17,20})>/;

export default {
  data: new SlashCommandBuilder()
    .setName('emoji-leaderboard')
    .setDescription('Shows who uses (or receives) a specific emoji the most.')
    .addStringOption((option) =>
      option.setName('emoji').setDescription('The server emoji to look up.').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('direction')
        .setDescription('Sent by users, or received via reactions.')
        .addChoices({ name: 'Sent', value: 'sent' }, { name: 'Received', value: 'received' })
    )
    .addStringOption((option) =>
      option.setName('range').setDescription('The time range to query.').addChoices(...RANGE_CHOICES)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const input = interaction.options.getString('emoji');
    const direction = interaction.options.getString('direction') ?? 'sent';
    const range = interaction.options.getString('range') ?? 'alltime';
    const { since, label } = rangeToSince(range);

    const match = input.match(EMOJI_INPUT_REGEX);
    if (!match) {
      return interaction.editReply('That doesn\'t look like a custom emoji. Type `:emojiname:` and pick it from the autocomplete list.');
    }

    const emoji = interaction.guild.emojis.cache.get(match[1]);
    if (!emoji) {
      return interaction.editReply("That emoji isn't from this server.");
    }

    const rows = getItemLeaderboard({ kind: 'emoji', itemId: emoji.id, direction, since, limit: 10 });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${emoji.name} — ${direction === 'received' ? 'Received' : 'Sent'} Leaderboard`)
      .setDescription(label)
      .setThumbnail(emoji.imageURL());

    if (!rows.length) {
      embed.addFields({ name: '​', value: 'No usage recorded yet.' });
    } else {
      const lines = await Promise.all(
        rows.map(async (row, i) => {
          const member = await interaction.guild.members.fetch(row.userId).catch(() => null);
          const name = member ? member.displayName : `Unknown User (${row.userId})`;
          return `${i + 1}. ${name} — **${row.count}**`;
        })
      );
      embed.addFields({ name: '​', value: lines.join('\n') });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
