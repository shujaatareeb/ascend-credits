import crypto from 'crypto';
import { awardCredits } from './economy.js';
import { query } from './database.js';

const rewardCooldown = new Map();
const recentHashes = new Map();
const burstWindows = new Map();

function hashNormalized(content) {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function registerMessageTracker(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith('/')) return;
    if (message.content.trim().length < 10) return;

    const userId = message.author.id;
    const now = Date.now();

    const lastRewardAt = rewardCooldown.get(userId) ?? 0;
    if (now - lastRewardAt < 30_000) {
      await persistMessageEvent(message, false, 0);
      return;
    }

    const digest = hashNormalized(message.content);
    const userHashes = recentHashes.get(userId) ?? [];
    const freshHashes = userHashes.filter((h) => now - h.ts <= 120_000);
    if (freshHashes.some((h) => h.digest === digest)) {
      recentHashes.set(userId, freshHashes);
      await persistMessageEvent(message, false, 0, digest);
      return;
    }

    const burst = burstWindows.get(userId) ?? [];
    const freshBurst = burst.filter((ts) => now - ts <= 10 * 60_000);
    if (freshBurst.length >= 10) {
      burstWindows.set(userId, freshBurst);
      await persistMessageEvent(message, false, 0, digest);
      return;
    }

    const award = await awardCredits({
      userId,
      amount: 1,
      source: 'text',
      referenceId: message.id
    });

    rewardCooldown.set(userId, now);
    freshHashes.push({ digest, ts: now });
    recentHashes.set(userId, freshHashes);
    freshBurst.push(now);
    burstWindows.set(userId, freshBurst);

    await persistMessageEvent(message, award.awarded > 0, award.awarded, digest);
  });
}

async function persistMessageEvent(message, wasRewarded, rewardedAc, digest = null) {
  await query(
    `INSERT INTO message_events (
      user_id, channel_id, message_id, message_hash, length_int, was_rewarded, rewarded_ac
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      message.author.id,
      message.channel.id,
      message.id,
      digest,
      message.content.length,
      wasRewarded,
      rewardedAc
    ]
  );

  if (wasRewarded) {
    await query(
      `UPDATE users
       SET monthly_message_count_valid = monthly_message_count_valid + 1,
           updated_at = NOW()
       WHERE user_id = $1`,
      [message.author.id]
    );
  }
}
