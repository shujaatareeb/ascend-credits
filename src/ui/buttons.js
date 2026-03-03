import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function ticketUserButtons(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:confirm:${ticketId}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket:cancel:${ticketId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
}

export function ticketModButtons(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:approve:${ticketId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket:deny:${ticketId}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
  );
}
