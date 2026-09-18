import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getUserBreakdown } from '../database/statements.js';
import { rangeToSince, RANGE_CHOICES } from '../helpers/utilities.js';

function formatRows(guild, rows, kind) {
  if (!rows.length) return 'No usage recorded yet.';
  return rows
    .map((row, i) => {
      const display =
        kind === 'emoji'
          ? guild.emojis.cache.get(row.itemId)?.toString() ?? `\`${row.itemName}\``
          : `\`${row.itemName}\``;
      return `${i + 1}. ${display} — **${row.count}**`;
    })
    .join('\n');
}

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription("Shows a user's personal emoji & sticker usage.")
    .addUserOption((option) => option.setName('user').setDescription('The user to look up (defaults to you).'))
    .addStringOption((option) =>
      option.setName('range').setDescription('The time range to query.').addChoices(...RANGE_CHOICES)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('user') ?? interaction.user;
    const range = interaction.options.getString('range') ?? 'alltime';
    const { since, label } = rangeToSince(range);

    const emojiRows = getUserBreakdown({ kind: 'emoji', userId: target.id, since, limit: 12 });
    const stickerRows = getUserBreakdown({ kind: 'sticker', userId: target.id, since, limit: 12 });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${target.username}'s Usage Stats`)
      .setDescription(label)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Top Emojis', value: formatRows(interaction.guild, emojiRows, 'emoji'), inline: true },
        { name: 'Top Stickers', value: formatRows(interaction.guild, stickerRows, 'sticker'), inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
