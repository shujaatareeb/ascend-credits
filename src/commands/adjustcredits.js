import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { adjustCredits } from '../economy.js';

export const data = new SlashCommandBuilder()
  .setName('adjustcredits')
  .setDescription('Admin only adjust user credits')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addIntegerOption((o) => o.setName('amount_ac').setDescription('Adjustment amount').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true));

export async function execute(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    await interaction.reply({ content: 'Admin only command.', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount_ac', true);
  const reason = interaction.options.getString('reason', true);

  await adjustCredits({ userId: user.id, amount, reason, actorId: interaction.user.id });
  await interaction.reply({ content: `Adjusted ${amount} AC for <@${user.id}>`, ephemeral: true });
}
