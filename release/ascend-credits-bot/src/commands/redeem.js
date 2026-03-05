import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { loadCatalog } from '../shop_catalog.js';

export const data = new SlashCommandBuilder()
  .setName('redeem')
  .setDescription('Redeem Ascend Credits for a digital game package');

export async function execute(interaction) {
  const catalog = await loadCatalog();

  const gameMenu = new StringSelectMenuBuilder()
    .setCustomId('redeem:game')
    .setPlaceholder('Select a game')
    .addOptions(
      catalog.products.map((product) => ({
        label: product.game.slice(0, 100),
        description: `${product.denominations.length} packages`.slice(0, 100),
        value: String(product.gameIndex)
      }))
    );

  await interaction.reply({
    content: 'Choose a game to view redeemable packages.',
    components: [new ActionRowBuilder().addComponents(gameMenu)],
    ephemeral: true
  });
}
