import { Client, Collection, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from './config.js';
import { getBalance } from './economy.js';
import {
  buildGameSelectRow,
  buildPackageSelectResponse,
  ensureInfrastructure,
  postOrRefreshRedeemPanel
} from './infrastructure.js';
import { createPurchaseTicket, getTicketDetails, markCodeDelivered, refundTicket, syncCatalogToStock, closeTicket } from './redemption.js';
import { loadCatalog, getGameByIndex, getPackageByIndexes } from './shop_catalog.js';
import { ticketAdminButtons } from './ui/buttons.js';
import { balanceEmbed } from './ui/embeds.js';
import {
  ActionRowBuilder,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  StringSelectMenuBuilder
} from 'discord.js';
import { config } from './config.js';
import { registerVoiceTracker } from './voice_tracker.js';
import { registerMessageTracker } from './message_tracker.js';
import { registerSchedulers } from './scheduler.js';
import { approveTicket, closeTicket, createPurchaseTicket, denyTicketWithRefund, syncCatalogToStock } from './redemption.js';
import { loadCatalog, getGameByIndex, getPackageByIndexes } from './shop_catalog.js';
import { ticketModButtons } from './ui/buttons.js';
import * as balance from './commands/balance.js';
import * as shop from './commands/shop.js';
import * as redeem from './commands/redeem.js';
import * as leaderboard from './commands/leaderboard.js';
import * as adjustcredits from './commands/adjustcredits.js';
import * as addstock from './commands/addstock.js';
import * as removestock from './commands/removestock.js';
import * as setup from './commands/setup.js';

const commandModules = [setup, adjustcredits, addstock, removestock];
const commandModules = [adjustcredits, addstock, removestock];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
let infra = null;

for (const command of commandModules) {
  client.commands.set(command.data.name, command);
}

function isAdminMember(interaction) {
  return interaction.member?.roles?.cache?.has(config.adminRoleId);
}

async function safeDm(clientUser, content) {
  try {
    await clientUser.send(content);
  } catch (error) {
    console.warn('Could not DM user:', clientUser.id, error.message);
  }
}

client.once(Events.ClientReady, async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), {
    body: commandModules.map((c) => c.data.toJSON())
  });

  const catalog = await loadCatalog();
  await syncCatalogToStock(catalog);

  const guild = await client.guilds.fetch(config.guildId);
  infra = await ensureInfrastructure(guild);
  await postOrRefreshRedeemPanel(infra.redeemChannel);

  registerVoiceTracker(client);
  registerMessageTracker(client);
  registerSchedulers();
  console.log(`Ready as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      const result = await command.execute(interaction);
      if (interaction.commandName === 'setup' && result) {
        infra = result;
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'redeem:game') {
        const gameIndex = Number(interaction.values[0]);
        const game = await getGameByIndex(gameIndex);
        if (!game) {
          await interaction.update({ content: 'Invalid game selection.', components: [] });
          return;
        }

        const packageMenu = new StringSelectMenuBuilder()
          .setCustomId(`redeem:package:${gameIndex}`)
          .setPlaceholder(`Select package for ${game.game.slice(0, 80)}`)
          .addOptions(
            game.denominations.map((denomination) => ({
              label: denomination.amount.slice(0, 100),
              description: `${denomination.costAc} AC (₹${denomination.discountedPriceInr.toFixed(2)})`.slice(0, 100),
              value: String(denomination.packageIndex)
            }))
          );

        await interaction.update({
          content: `**${game.game}**\n${game.description}`,
          components: [new ActionRowBuilder().addComponents(packageMenu)]
        });
        return;
      }

      if (interaction.customId.startsWith('redeem:package:')) {
        const gameIndex = Number(interaction.customId.split(':')[2]);
        const packageIndex = Number(interaction.values[0]);
        const game = await getGameByIndex(gameIndex);
        const selectedPackage = await getPackageByIndexes(gameIndex, packageIndex);

        if (!game || !selectedPackage) {
          await interaction.update({ content: 'Invalid package selection.', components: [] });
          return;
        }

        const { channel, ticketId } = await createPurchaseTicket({
          guild: interaction.guild,
          user: interaction.user,
          item: selectedPackage
        });

        await channel.send({
          content:
            `User: <@${interaction.user.id}>\nGame: ${game.game}\nPackage: ${selectedPackage.amount}\n` +
            `Debited: ${selectedPackage.costAc} AC\nTicket ID: ${ticketId}\n` +
            'Admins: approve, deny+refund, or close this ticket.',
          components: [ticketModButtons(ticketId)]
        });

        await interaction.update({
          content: `Purchase ticket created: <#${channel.id}>. ${selectedPackage.costAc} AC has been locked for this order.`,
          components: []
        });
      }
      return;
    }

    if (interaction.isButton()) {
      const [scope, action, rawId] = interaction.customId.split(':');

      if (scope === 'panel') {
        if (action === 'view-balance') {
          const balance = await getBalance(interaction.user.id);
          await interaction.reply({ embeds: [balanceEmbed(balance)], ephemeral: true });
          return;
        }

        if (action === 'start-redeem') {
          const gameRow = await buildGameSelectRow();
          const balance = await getBalance(interaction.user.id);
          await interaction.reply({
            content: `Select a game to continue. Current balance: ${balance.ac_balance} AC`,
            components: [gameRow],
            ephemeral: true
          });
        }

        return;
      }

      if (scope === 'ticket') {
        if (!isAdminMember(interaction)) {
          await interaction.reply({ content: 'Only admins can use ticket actions.', ephemeral: true });
          return;
        }

        const ticketId = Number(rawId);
        const details = await getTicketDetails(ticketId);
        if (!details) {
          await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
          return;
        }

        const ticketUrl = `https://discord.com/channels/${config.guildId}/${details.discord_channel_id}`;
        const targetUser = await client.users.fetch(details.user_id);

        if (action === 'refund') {
          const result = await refundTicket(ticketId, interaction.user.id);
          await safeDm(
            targetUser,
            `Your redemption request was cancelled and refunded.\nOrder: ${details.game} — ${details.denomination_label}\nTicket: ${ticketUrl}\nCurrent wallet balance: ${result.balance.ac_balance} AC`
          );

          await infra.adminLogChannel.send(
            `Refunded ticket #${ticketId} for <@${details.user_id}> (${details.game} — ${details.denomination_label}).`
          );
          await interaction.reply({ content: 'Order cancelled and refunded.', ephemeral: true });
          return;
        }

        if (action === 'delivered') {
          const result = await markCodeDelivered(ticketId, interaction.user.id);
          await safeDm(
            targetUser,
            `Your order has been delivered.\nOrder: ${details.game} — ${details.denomination_label}\nTicket: ${ticketUrl}\nCurrent wallet balance: ${result.balance.ac_balance} AC`
          );

          await infra.redeemHistoryChannel.send(`Someone just redeemed ${details.game} — ${details.denomination_label}.`);
          await infra.adminLogChannel.send(
            `Delivered ticket #${ticketId} for <@${details.user_id}> (${details.game} — ${details.denomination_label}).`
          );

          await interaction.reply({ content: 'Marked as delivered and user notified.', ephemeral: true });
          return;
        }

        if (action === 'close') {
          await closeTicket(ticketId, interaction.user.id);
          await infra.adminLogChannel.send(`Closed ticket #${ticketId} (${details.game} — ${details.denomination_label}).`);
          await interaction.reply({ content: 'Ticket closed.', ephemeral: true });
          return;
        }
      }

      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'redeem:game') {
        const game = await getGameByIndex(Number(interaction.values[0]));
        if (!game) {
          await interaction.update({ content: 'Invalid game selection.', components: [] });
          return;
        }

        const response = await buildPackageSelectResponse(interaction.user.id, game);
        await interaction.update({
          content: `Choose denomination. Current balance: ${response.balance.ac_balance} AC`,
          embeds: [response.embed],
          components: [response.row]
        });
        return;
      }

      if (interaction.customId.startsWith('redeem:package:')) {
        const gameIndex = Number(interaction.customId.split(':')[2]);
        const packageIndex = Number(interaction.values[0]);
        const game = await getGameByIndex(gameIndex);
        const selectedPackage = await getPackageByIndexes(gameIndex, packageIndex);

        if (!game || !selectedPackage) {
          await interaction.update({ content: 'Invalid package selection.', components: [] });
          return;
        }

        const { channel, ticketId, balance } = await createPurchaseTicket({
          guild: interaction.guild,
          user: interaction.user,
          item: selectedPackage,
          gameName: game.game,
          ticketCategoryId: infra.category.id
        });

        await channel.send({
          content:
            `Requester: <@${interaction.user.id}>\nGame: ${game.game}\nDenomination: ${selectedPackage.amount}\n` +
            `Price: ${selectedPackage.costAc} AC\nTicket #${ticketId}`,
          components: [ticketAdminButtons(ticketId)]
        });

        await infra.adminLogChannel.send(
          `New redeem request #${ticketId} by <@${interaction.user.id}> for ${game.game} — ${selectedPackage.amount} (${selectedPackage.costAc} AC).`
        );

        await interaction.update({
          content:
            `Request created: <#${channel.id}>\n` +
            `Current balance: ${balance.ac_balance} AC (Locked: ${balance.ac_pending_locked} AC)`,
          embeds: [],
          components: []
        });
      }
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Moderator or admin only.', ephemeral: true });
      return;
    }

    if (action === 'approve') {
      await approveTicket(ticketId, interaction.user.id);
      await interaction.reply({ content: 'Ticket approved.', ephemeral: true });
      return;
    }

    if (action === 'deny') {
      await denyTicketWithRefund(ticketId, interaction.user.id);
      await interaction.reply({ content: 'Ticket denied and credits refunded.', ephemeral: true });
      return;
    }

    if (action === 'close') {
      await closeTicket(ticketId, interaction.user.id);
      await interaction.reply({ content: 'Ticket closed.', ephemeral: true });
      return;
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      const message = error?.message ?? 'Something went wrong processing this interaction.';
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

client.login(config.token);
