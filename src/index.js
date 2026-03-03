import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  PermissionFlagsBits
} from 'discord.js';
import { config } from './config.js';
import { registerVoiceTracker } from './voice_tracker.js';
import { registerMessageTracker } from './message_tracker.js';
import { registerSchedulers } from './scheduler.js';
import { confirmTicket } from './redemption.js';
import * as balance from './commands/balance.js';
import * as shop from './commands/shop.js';
import * as redeem from './commands/redeem.js';
import * as leaderboard from './commands/leaderboard.js';
import * as adjustcredits from './commands/adjustcredits.js';
import * as addstock from './commands/addstock.js';
import * as removestock from './commands/removestock.js';

const commandModules = [balance, shop, redeem, leaderboard, adjustcredits, addstock, removestock];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();
for (const command of commandModules) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), {
    body: commandModules.map((c) => c.data.toJSON())
  });

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
      await command.execute(interaction);
      return;
    }

    if (!interaction.isButton()) return;
    const [scope, action, ticketId] = interaction.customId.split(':');
    if (scope !== 'ticket') return;

    if (action === 'confirm') {
      await confirmTicket(ticketId, interaction.user.id);
      await interaction.reply({ content: 'Ticket confirmed. Credits locked pending moderator decision.', ephemeral: true });
      return;
    }

    if (action === 'cancel') {
      await interaction.reply({ content: 'Ticket cancelled. Ask staff to close this channel.', ephemeral: true });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Moderator or admin only.', ephemeral: true });
      return;
    }

    if (action === 'approve' || action === 'deny') {
      await interaction.reply({ content: `${action} handling scaffolded. Implement final stock + ledger transitions here.`, ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Something went wrong processing this interaction.', ephemeral: true });
    }
  }
});

client.login(config.token);
