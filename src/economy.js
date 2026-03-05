import { ensureUser, query, withTransaction } from './database.js';

export async function getBalance(userId) {
  await ensureUser(userId);
  const { rows } = await query(
    `SELECT ac_balance, ac_pending_locked, lifetime_ac_earned
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

// Backward-compatible no-op: engagement earning is disabled in wallet-only mode.
export async function awardCredits() {
  return { awarded: 0, reason: 'earning_disabled_wallet_only' };
}

export async function adjustCredits({ userId, amount, reason, actorId }) {
  await ensureUser(userId);
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET ac_balance = GREATEST(0, ac_balance + $2),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, amount]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, source, amount_ac, reference_id, status)
       VALUES ($1, 'adjust', 'mod', $2, $3, 'success')`,
      [userId, amount, `${actorId}:${reason}`]
    );
  });
}
