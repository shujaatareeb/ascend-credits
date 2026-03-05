import { EmbedBuilder } from 'discord.js';

export function balanceEmbed({ ac_balance, ac_pending_locked, lifetime_ac_earned }) {
  return new EmbedBuilder()
    .setTitle('Ascend Wallet')
    .setDescription('Ascend Credits (AC) is your wallet currency for redeeming game packages.')
    .addFields(
      { name: 'Available Balance', value: `${ac_balance} AC`, inline: true },
      { name: 'Locked in Active Orders', value: `${ac_pending_locked} AC`, inline: true },
      { name: 'Lifetime Earned', value: `${lifetime_ac_earned} AC`, inline: true }
    );
}

export function redeemPanelEmbed(catalog) {
  const lines = catalog.products.flatMap((product) =>
    product.denominations.map(
      (denomination) =>
        `• **${product.game}** — ${denomination.amount}: ₹${denomination.discountedPriceInr.toFixed(2)} (${denomination.costAc} AC)`
    )
  );

  return new EmbedBuilder()
    .setTitle('Ascend Credits Redemption')
    .setDescription(
      [
        'Use **Redeem Ascend Credits** to place an order. Use **View Balance** anytime during checkout.',
        `Conversion: **1 INR = ${catalog.conversionRate} AC**.`,
        '',
        '**Available Stock**',
        ...lines
      ]
        .join('\n')
        .slice(0, 4000)
    );
}

export function gamePackagesEmbed(game, balance) {
  return new EmbedBuilder()
    .setTitle(game.game)
    .setDescription(game.description)
    .addFields(
      { name: 'Current Wallet Balance', value: `${balance.ac_balance} AC`, inline: true },
      { name: 'Locked', value: `${balance.ac_pending_locked} AC`, inline: true }
    );
}
