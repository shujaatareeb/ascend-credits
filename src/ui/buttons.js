import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function redeemPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('panel:start-redeem').setLabel('Redeem Ascend Credits').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('panel:view-balance').setLabel('View Balance').setStyle(ButtonStyle.Secondary)
  );
}

export function ticketAdminButtons(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:refund:${ticketId}`).setLabel('Cancel & Refund').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket:delivered:${ticketId}`).setLabel('Code Delivered').setStyle(ButtonStyle.Success),
export function ticketModButtons(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:approve:${ticketId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket:deny:${ticketId}`).setLabel('Deny + Refund').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Secondary)
  );
}
