import dotenv from 'dotenv';

dotenv.config();

const required = ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'ADMIN_ROLE_ID', 'DATABASE_URL'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  databaseUrl: process.env.DATABASE_URL,
  redemptionCategoryId: process.env.REDEMPTION_CATEGORY_ID ?? null,
  redeemChannelId: process.env.REDEEM_CHANNEL_ID ?? null,
  redeemHistoryChannelId: process.env.REDEEM_HISTORY_CHANNEL_ID ?? null,
  adminLogChannelId: process.env.ADMIN_LOG_CHANNEL_ID ?? null,
  ticketChannelHintId: process.env.TICKETS_CHANNEL_ID ?? null
};
