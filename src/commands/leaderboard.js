import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getItemCounts, getUserCounts } from '../database/statements.js';
import { rangeToSince, RANGE_CHOICES } from '../helpers/utilities.js';

const PAGE_SIZE = 15;
const COLLECTOR_TIME_MS = 120_000;
const MEDALS = ['🥇', '🥈', '🥉'];

function buildItemEntries(guild, kind, rows, order) {
  const counts = new Map(rows.map((row) => [row.itemId, row.count]));
  const source = kind === 'emoji' ? guild.emojis.cache : guild.stickers.cache;

  const entries = source.map((item) => ({
    display: kind === 'emoji' ? `${item} \`:${item.name}:\`` : `\`${item.name}\``,
    name: item.name,
    count: counts.get(item.id) ?? 0,
  }));

  entries.sort((a, b) => {
    const diff = order === 'least' ? a.count - b.count : b.count - a.count;
    return diff || a.name.localeCompare(b.name);
  });
  return entries;
}

function rankLabel(index, useMedals) {
  return useMedals && index < 3 ? MEDALS[index] : `${index + 1}.`;
}

async function formatPageLines(guild, scope, pageEntries, startIndex, useMedals) {
  if (scope === 'items') {
    return pageEntries.map(
      (entry, i) => `${rankLabel(startIndex + i, useMedals)} ${entry.display} — **${entry.count}**`
    );
  }

  return Promise.all(
    pageEntries.map(async (entry, i) => {
      const member = await guild.members.fetch(entry.userId).catch(() => null);
      const name = member ? member.displayName : `Unknown User (${entry.userId})`;
      return `${rankLabel(startIndex + i, useMedals)} ${name} — **${entry.count}**`;
    })
  );
}

function navigationRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
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
          { name: 'Emojis', value: 'top-emojis' },
          { name: 'Stickers', value: 'top-stickers' },
          { name: 'Users (Emojis)', value: 'top-users-emoji' },
          { name: 'Users (Stickers)', value: 'top-users-sticker' }
        )
    )
    .addStringOption((option) =>
      option.setName('range').setDescription('The time range to query.').addChoices(...RANGE_CHOICES)
    )
    .addStringOption((option) =>
      option
        .setName('order')
        .setDescription('Emoji/sticker boards only. Least used includes ones with zero uses.')
        .addChoices({ name: 'Most used', value: 'most' }, { name: 'Least used', value: 'least' })
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const { guild } = interaction;
    const board = interaction.options.getString('board');
    const range = interaction.options.getString('range') ?? 'alltime';
    const order = interaction.options.getString('order') ?? 'most';
    const { since, label } = rangeToSince(range);

    const scope = board.startsWith('top-users') ? 'users' : 'items';
    const kind = board.includes('sticker') ? 'sticker' : 'emoji';
    const kindLabel = kind === 'emoji' ? 'Emojis' : 'Stickers';

    const entries =
      scope === 'items'
        ? buildItemEntries(guild, kind, getItemCounts({ kind, since }), order)
        : getUserCounts({ kind, since });

    const useMedals = scope === 'users' || order === 'most';
    const title =
      scope === 'items'
        ? `${order === 'least' ? 'Least Used' : 'Most Used'} ${kindLabel} — ${guild.name}`
        : `Top Users by ${kindLabel.slice(0, -1)} Usage — ${guild.name}`;

    if (!entries.length) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(title)
        .setDescription(`${label}\n\nNo usage recorded yet.`);
      return interaction.editReply({ embeds: [embed] });
    }

    const totalPages = Math.ceil(entries.length / PAGE_SIZE);

    const renderPage = async (page) => {
      const start = page * PAGE_SIZE;
      const lines = await formatPageLines(guild, scope, entries.slice(start, start + PAGE_SIZE), start, useMedals);
      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(title)
        .setDescription(`${label}\n\n${lines.join('\n')}`)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${entries.length} total` });
    };

    let page = 0;
    const message = await interaction.editReply({
      embeds: [await renderPage(page)],
      components: totalPages > 1 ? [navigationRow(page, totalPages)] : [],
    });

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_TIME_MS,
    });

    collector.on('collect', async (button) => {
      if (button.user.id !== interaction.user.id) {
        return button.reply({
          content: 'Only the person who ran this command can use these buttons.',
          ephemeral: true,
        });
      }

      page = Math.min(Math.max(page + (button.customId === 'next' ? 1 : -1), 0), totalPages - 1);
      await button.update({
        embeds: [await renderPage(page)],
        components: [navigationRow(page, totalPages)],
      });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
