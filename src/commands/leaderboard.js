import { SlashCommandBuilder } from 'discord.js';
import { query } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show top earners for the current month');

export async function execute(interaction) {
  const { rows } = await query(
    `SELECT user_id, monthly_ac_earned
     FROM users
     ORDER BY monthly_ac_earned DESC
     LIMIT 10`
  );
  const body = rows.length
    ? rows.map((r, idx) => `${idx + 1}. <@${r.user_id}> — ${r.monthly_ac_earned} AC`).join('\n')
    : 'No earners yet.';
  await interaction.reply({ content: body, ephemeral: true });
}
