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

    if (!interaction.isButton()) return;
    const [scope, action, ticketId] = interaction.customId.split(':');
    if (scope !== 'ticket') return;

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
