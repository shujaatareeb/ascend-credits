import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { adjustCredits } from '../economy.js';

async function safeDm(user, content) {
  try {
    await user.send(content);
  } catch {
    // Ignore DM failures (privacy settings, blocked DMs, etc.)
  }
}

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

  const balance = await adjustCredits({ userId: user.id, amount, reason, actorId: interaction.user.id });

  await safeDm(
    user,
    `Your Ascend wallet has been updated by an admin.\n` +
      `Change: ${amount >= 0 ? '+' : ''}${amount} AC\n` +
      `Reason: ${reason}\n` +
      `Current wallet balance: ${balance.ac_balance} AC\n` +
      `Locked: ${balance.ac_pending_locked} AC`
  );

  await interaction.reply({
    content: `Adjusted ${amount} AC for <@${user.id}>. New balance: ${balance.ac_balance} AC`,
    ephemeral: true
  });
}
