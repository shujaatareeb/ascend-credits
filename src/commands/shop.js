import { SlashCommandBuilder } from 'discord.js';
import { listShopItems } from '../redemption.js';
import { shopEmbed } from '../ui/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Show redeemable stock items and their Ascend Credits cost');

export async function execute(interaction) {
  const items = await listShopItems();
  await interaction.reply({ embeds: [shopEmbed(items)], ephemeral: true });
}
