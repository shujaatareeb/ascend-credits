import { ActionRowBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';
import { config } from './config.js';
import { query } from './database.js';
import { getBalance } from './economy.js';
import { loadCatalog } from './shop_catalog.js';
import { redeemPanelButtons } from './ui/buttons.js';
import { gamePackagesEmbed, redeemPanelEmbed } from './ui/embeds.js';

async function getOrCreateCategory(guild) {
  if (config.redemptionCategoryId) {
    const existing = guild.channels.cache.get(config.redemptionCategoryId);
    if (existing?.type === ChannelType.GuildCategory) return existing;
  }

  const byName = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'ascend-redemptions'
  );
  if (byName) return byName;

  return guild.channels.create({ name: 'ascend-redemptions', type: ChannelType.GuildCategory });
}

async function getOrCreateTextChannel(guild, categoryId, name, topic, isPrivateAdmin = false) {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.parentId === categoryId && c.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) {
    if (!existing.topic || existing.topic !== topic) {
      await existing.setTopic(topic);
    }
    return existing;
  }

  const overwrites = [{ id: guild.id, allow: [PermissionFlagsBits.ViewChannel] }];
  if (isPrivateAdmin) {
    overwrites[0] = { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] };
    overwrites.push({
      id: config.adminRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic,
    permissionOverwrites: overwrites
  });
}

export async function ensureInfrastructure(guild) {
  const category = await getOrCreateCategory(guild);
  const redeemChannel = await getOrCreateTextChannel(
    guild,
    category.id,
    'redeem',
    'Main redemption panel for Ascend Credits stock and wallet actions.'
  );
  const redeemHistoryChannel = await getOrCreateTextChannel(
    guild,
    category.id,
    'redeem-history',
    'Approved redemptions are posted here.'
  );
  const ticketsChannel = await getOrCreateTextChannel(
    guild,
    category.id,
    'tickets',
    'Reference channel for ticket handling. Individual ticket channels are also created in this category.'
  );
  const adminLogChannel = await getOrCreateTextChannel(
    guild,
    category.id,
    'admin-log',
    'Private log for all redemption requests and admin actions.',
    true
  );

  await query(
    `INSERT INTO bot_meta(key, value) VALUES
      ('category_id', $1),
      ('redeem_channel_id', $2),
      ('redeem_history_channel_id', $3),
      ('tickets_channel_id', $4),
      ('admin_log_channel_id', $5)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [category.id, redeemChannel.id, redeemHistoryChannel.id, ticketsChannel.id, adminLogChannel.id]
  );

  return {
    category,
    redeemChannel,
    redeemHistoryChannel,
    ticketsChannel,
    adminLogChannel
  };
}

export async function postOrRefreshRedeemPanel(channel) {
  const catalog = await loadCatalog();

  await channel.send({
    embeds: [redeemPanelEmbed(catalog)],
    components: [redeemPanelButtons()]
  });
}

export async function buildGameSelectRow() {
  const catalog = await loadCatalog();
  const menu = new StringSelectMenuBuilder()
    .setCustomId('redeem:game')
    .setPlaceholder('Select a game')
    .addOptions(
      catalog.products.map((product) => ({
        label: product.game.slice(0, 100),
        description: `${product.denominations.length} denominations`.slice(0, 100),
        value: String(product.gameIndex)
      }))
    );

  return new ActionRowBuilder().addComponents(menu);
}

export async function buildPackageSelectResponse(userId, game) {
  const balance = await getBalance(userId);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`redeem:package:${game.gameIndex}`)
    .setPlaceholder('Choose denomination')
    .addOptions(
      game.denominations.map((denomination) => ({
        label: denomination.amount.slice(0, 100),
        description: `${denomination.costAc} AC`.slice(0, 100),
        value: String(denomination.packageIndex)
      }))
    );

  return {
    embed: gamePackagesEmbed(game, balance),
    row: new ActionRowBuilder().addComponents(menu),
    balance
  };
}
