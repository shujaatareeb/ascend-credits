import { SlashCommandBuilder } from 'discord.js';
import { query } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show top wallet balances');

export async function execute(interaction) {
  const { rows } = await query(
    `SELECT user_id, ac_balance
     FROM users
     ORDER BY ac_balance DESC
     LIMIT 10`
  );

  const body = rows.length
    ? rows.map((r, idx) => `${idx + 1}. <@${r.user_id}> — ${r.ac_balance} AC`).join('\n')
    : 'No wallet data yet.';

  await interaction.reply({ content: body, ephemeral: true });
}
