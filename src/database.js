import { Pool } from 'pg';
import { config } from './config.js';

export const pool = new Pool({
  connectionString: config.databaseUrl
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureUser(userId) {
  await query(
    `INSERT INTO users (
      user_id,
      ac_balance,
      ac_pending_locked,
      monthly_ac_earned,
      lifetime_ac_earned,
      monthly_voice_minutes_valid,
      monthly_message_count_valid
    )
    VALUES ($1, 0, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}
