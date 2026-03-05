import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { ensureInfrastructure, postOrRefreshRedeemPanel } from '../infrastructure.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Admin only: set redemption category/channel and post initial redeem panel')
  .addChannelOption((o) =>
    o
      .setName('category')
      .setDescription('Category where redemption channels and tickets should exist')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(false)
  )
  .addChannelOption((o) =>
    o
      .setName('panel_channel')
      .setDescription('Text channel where the initial redeem panel should be posted')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  );

export async function execute(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    await interaction.reply({ content: 'Admin only command.', ephemeral: true });
    return;
  }

  const category = interaction.options.getChannel('category');
  const panelChannel = interaction.options.getChannel('panel_channel');

  const infra = await ensureInfrastructure(interaction.guild, {
    category,
    redeemChannel: panelChannel
  });

  await postOrRefreshRedeemPanel(infra.redeemChannel);

  await interaction.reply({
    content:
      `Setup complete.\n` +
      `Category: <#${infra.category.id}>\n` +
      `Redeem panel channel: <#${infra.redeemChannel.id}>\n` +
      `Redeem history: <#${infra.redeemHistoryChannel.id}>\n` +
      `Tickets: <#${infra.ticketsChannel.id}>\n` +
      `Admin log: <#${infra.adminLogChannel.id}>`,
    ephemeral: true
  });

  return infra;
}
