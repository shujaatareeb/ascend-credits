import { SlashCommandBuilder } from 'discord.js';
import { createRedemptionTicket } from '../redemption.js';
import { ticketModButtons, ticketUserButtons } from '../ui/buttons.js';

export const data = new SlashCommandBuilder()
  .setName('redeem')
  .setDescription('Start a redemption request for an item')
  .addStringOption((o) => o.setName('item_id').setDescription('Catalog item id').setRequired(true));

export async function execute(interaction) {
  const itemId = interaction.options.getString('item_id', true);
  const { channel, ticketId, item } = await createRedemptionTicket({
    guild: interaction.guild,
    user: interaction.user,
    itemId
  });

  await channel.send({
    content:
      `User: <@${interaction.user.id}>\nRequested Item: ${item.item_id}\nCost AC: ${item.cost_ac}` +
      '\nUse buttons below to confirm/cancel. Mods can approve/deny after confirmation.',
    components: [ticketUserButtons(ticketId), ticketModButtons(ticketId)]
  });

  await interaction.reply({ content: `Ticket created: <#${channel.id}>`, ephemeral: true });
}
