import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getTopItems, getTopUsers } from '../database/statements.js';
import { rangeToSince, RANGE_CHOICES } from '../helpers/utilities.js';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatItemLine(guild, kind, row, index) {
  const rank = MEDALS[index] ?? `${index + 1}.`;
  const display =
    kind === 'emoji'
      ? guild.emojis.cache.get(row.itemId)?.toString() ?? `\`${row.itemName}\` (deleted)`
      : `\`${row.itemName}\`${guild.stickers.cache.has(row.itemId) ? '' : ' (deleted)'}`;
  return `${rank} ${display} — **${row.count}**`;
}

async function formatUserLine(guild, row, index) {
  const rank = MEDALS[index] ?? `${index + 1}.`;
  const member = await guild.members.fetch(row.userId).catch(() => null);
  const name = member ? member.displayName : `Unknown User (${row.userId})`;
  return `${rank} ${name} — **${row.count}**`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription("Shows this server's usage leaderboard.")
    .addStringOption((option) =>
      option
        .setName('board')
        .setDescription('Which leaderboard to show.')
        .setRequired(true)
        .addChoices(
          { name: 'Top Emojis', value: 'top-emojis' },
          { name: 'Top Stickers', value: 'top-stickers' },
          { name: 'Top Users (Emojis)', value: 'top-users-emoji' },
          { name: 'Top Users (Stickers)', value: 'top-users-sticker' }
        )
    )
    .addStringOption((option) =>
      option.setName('range').setDescription('The time range to query.').addChoices(...RANGE_CHOICES)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const board = interaction.options.getString('board');
    const range = interaction.options.getString('range') ?? 'alltime';
    const { since, label } = rangeToSince(range);

    const scope = board.startsWith('top-users') ? 'users' : 'items';
    const metric = board.endsWith('sticker') ? 'sticker' : 'emoji';

    const embed = new EmbedBuilder().setColor(0x5865f2).setDescription(label);

    if (scope === 'items') {
      const rows = getTopItems({ kind: metric, since, limit: 10 });
      embed.setTitle(`Top ${metric === 'emoji' ? 'Emojis' : 'Stickers'} — ${interaction.guild.name}`);
      const lines = rows.length
        ? rows.map((row, i) => formatItemLine(interaction.guild, metric, row, i))
        : ['No usage recorded yet.'];
      embed.addFields({ name: '​', value: lines.join('\n') });
    } else {
      const rows = getTopUsers({ kind: metric, since, limit: 10 });
      embed.setTitle(`Top Users by ${metric === 'emoji' ? 'Emoji' : 'Sticker'} Usage — ${interaction.guild.name}`);
      const lines = rows.length
        ? await Promise.all(rows.map((row, i) => formatUserLine(interaction.guild, row, i)))
        : ['No usage recorded yet.'];
      embed.addFields({ name: '​', value: lines.join('\n') });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
