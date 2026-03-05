import { SlashCommandBuilder } from 'discord.js';
import { getBalance } from '../economy.js';
import { balanceEmbed } from '../ui/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Show your Ascend Credits balance and monthly stats');

export async function execute(interaction) {
  const balance = await getBalance(interaction.user.id);
  await interaction.reply({ embeds: [balanceEmbed(balance)], ephemeral: true });
}
