import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function ticketModButtons(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:approve:${ticketId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket:deny:${ticketId}`).setLabel('Deny + Refund').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Secondary)
  );
}
