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

export function shopEmbed(catalog) {
  const lines = catalog.products.flatMap((product) =>
    product.denominations.map(
      (denomination) =>
        `• **${product.game}** — ${denomination.amount}: ₹${denomination.discountedPriceInr.toFixed(2)} → ${denomination.costAc} AC`
    )
  );

  return new EmbedBuilder()
    .setTitle('Ascend Redemption Shop')
    .setDescription(lines.join('\n').slice(0, 4000))
    .setFooter({ text: `Conversion rate: 1 INR = ${catalog.conversionRate} AC` });
}
