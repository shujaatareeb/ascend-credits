import { SlashCommandBuilder } from 'discord.js';
import { shopEmbed } from '../ui/embeds.js';
import { loadCatalog } from '../shop_catalog.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Show games, packages, and Ascend Credits pricing');

export async function execute(interaction) {
  const catalog = await loadCatalog();
  await interaction.reply({ embeds: [shopEmbed(catalog)], ephemeral: true });
}
