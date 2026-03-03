import dotenv from 'dotenv';

dotenv.config();

const required = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'MODERATOR_ROLE_ID',
  'ADMIN_ROLE_ID',
  'REWARDS_CHANNEL_ID',
  'TICKET_CATEGORY_ID',
  'DATABASE_URL'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
  moderatorRoleId: process.env.MODERATOR_ROLE_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  rewardsChannelId: process.env.REWARDS_CHANNEL_ID,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  databaseUrl: process.env.DATABASE_URL,
  economyLogChannelId: process.env.ECONOMY_LOG_CHANNEL_ID ?? null,
  redemptionLogChannelId: process.env.REDEMPTION_LOG_CHANNEL_ID ?? null,
  dailyCaps: {
    total: 80,
    text: 20,
    voice: 60
  }
};
