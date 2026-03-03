import { query } from './database.js';

export function registerSchedulers() {
  setInterval(runMonthlyResetIfNeeded, 60 * 60 * 1000);
}

async function runMonthlyResetIfNeeded() {
  const { rows } = await query('SELECT value FROM bot_meta WHERE key = $1', ['last_monthly_reset']);
  const last = rows[0]?.value;
  const now = new Date();
  const currentStamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  if (last === currentStamp) return;

  await query(
    `INSERT INTO leaderboard_snapshots (month_key, user_id, monthly_ac_earned)
     SELECT $1, user_id, monthly_ac_earned FROM users`,
    [currentStamp]
  );

  await query(
    `UPDATE users
     SET monthly_ac_earned = 0,
         monthly_voice_minutes_valid = 0,
         monthly_message_count_valid = 0,
         updated_at = NOW()`
  );

  await query(
    `INSERT INTO bot_meta (key, value)
     VALUES ('last_monthly_reset', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [currentStamp]
  );
}
