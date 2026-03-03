import { ensureUser, query, withTransaction } from './database.js';

function getUtcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function getBalance(userId) {
  await ensureUser(userId);
  const { rows } = await query(
    `SELECT ac_balance, ac_pending_locked, monthly_ac_earned, lifetime_ac_earned
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

export async function getTodayEarned(userId) {
  const day = getUtcDateString();
  const { rows } = await query(
    `SELECT
      COALESCE(SUM(CASE WHEN source = 'text' THEN amount_ac ELSE 0 END), 0) AS text,
      COALESCE(SUM(CASE WHEN source = 'voice' THEN amount_ac ELSE 0 END), 0) AS voice,
      COALESCE(SUM(amount_ac), 0) AS total
    FROM transactions
    WHERE user_id = $1
      AND type = 'earn'
      AND status = 'success'
      AND created_at::date = $2::date`,
    [userId, day]
  );
  return {
    text: Number(rows[0].text),
    voice: Number(rows[0].voice),
    total: Number(rows[0].total)
  };
}

export async function awardCredits({ userId, amount, source, referenceId }) {
  if (amount <= 0) return { awarded: 0, reason: 'zero_amount' };

  await ensureUser(userId);
  const today = await getTodayEarned(userId);

  const caps = { total: 80, text: 20, voice: 60 };
  const sourceCap = source === 'text' ? caps.text : caps.voice;

  const sourceRemaining = Math.max(0, sourceCap - today[source]);
  const totalRemaining = Math.max(0, caps.total - today.total);
  const effectiveAward = Math.min(amount, sourceRemaining, totalRemaining);

  if (effectiveAward <= 0) {
    return { awarded: 0, reason: 'daily_cap_reached' };
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET ac_balance = ac_balance + $2,
           monthly_ac_earned = monthly_ac_earned + $2,
           lifetime_ac_earned = lifetime_ac_earned + $2,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, effectiveAward]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, source, amount_ac, reference_id, status)
       VALUES ($1, 'earn', $2, $3, $4, 'success')`,
      [userId, source, effectiveAward, referenceId ?? null]
    );
  });

  return { awarded: effectiveAward, reason: 'awarded' };
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
