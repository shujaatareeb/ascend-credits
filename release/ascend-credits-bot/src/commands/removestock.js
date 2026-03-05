import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { query } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('removestock')
  .setDescription('Admin only remove stock quantity from an item')
  .addStringOption((o) => o.setName('item_id').setDescription('Item ID').setRequired(true))
  .addIntegerOption((o) => o.setName('quantity').setDescription('Quantity').setRequired(true));

export async function execute(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    await interaction.reply({ content: 'Admin only command.', ephemeral: true });
    return;
  }
  const itemId = interaction.options.getString('item_id', true);
  const quantity = interaction.options.getInteger('quantity', true);
  await query(
    `UPDATE stock_items
     SET stock_quantity = GREATEST(0, stock_quantity - $2), updated_at = NOW()
     WHERE item_id = $1`,
    [itemId, quantity]
  );
  await interaction.reply({ content: 'Stock removed.', ephemeral: true });
}
