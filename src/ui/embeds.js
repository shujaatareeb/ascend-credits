import { EmbedBuilder } from 'discord.js';

export function balanceEmbed({ ac_balance, ac_pending_locked, monthly_ac_earned, lifetime_ac_earned }) {
  return new EmbedBuilder()
    .setTitle('Ascend Credits Balance')
    .addFields(
      { name: 'Current AC Balance', value: String(ac_balance), inline: true },
      { name: 'Pending AC Locked', value: String(ac_pending_locked), inline: true },
      { name: 'Monthly AC Earned', value: String(monthly_ac_earned), inline: true },
      { name: 'Lifetime AC Earned', value: String(lifetime_ac_earned), inline: true }
    );
}

export function shopEmbed(items) {
  return new EmbedBuilder()
    .setTitle('Ascend Shop')
    .setDescription(
      items.length
        ? items
            .map((item) => `${item.game} • ${item.denomination_label} • ${item.cost_ac} AC • Stock: ${item.stock_quantity}`)
            .join('\n')
        : 'No active stock items right now.'
    );
}
