import { awardCredits } from './economy.js';
import { query } from './database.js';

const sessionState = new Map();

export function registerVoiceTracker(client) {
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;
    const channel = newState.channel;

    if (!channel) {
      await endSession(userId);
      return;
    }

    const valid = !newState.selfMute && !newState.selfDeaf && channel.members.size >= 2;
    if (!valid) {
      await endSession(userId);
      return;
    }

    const existing = sessionState.get(userId);
    if (!existing) {
      sessionState.set(userId, {
        userId,
        channelId: channel.id,
        startedAt: Date.now(),
        lastTick: Date.now()
      });
    }
  });

  setInterval(async () => {
    const entries = [...sessionState.values()];
    for (const state of entries) {
      const elapsedMinutes = Math.floor((Date.now() - state.lastTick) / 60000);
      if (elapsedMinutes < 10) continue;

      const chunks = Math.floor(elapsedMinutes / 10);
      state.lastTick += chunks * 10 * 60000;
      const award = await awardCredits({
        userId: state.userId,
        amount: chunks * 2,
        source: 'voice',
        referenceId: `voice:${state.channelId}`
      });

      await query(
        `INSERT INTO voice_sessions (
          user_id, channel_id, started_at, ended_at, valid_minutes, speaking_events_count, was_valid
        ) VALUES ($1, $2, NOW(), NOW(), $3, $4, $5)`,
        [state.userId, state.channelId, chunks * 10, chunks, award.awarded > 0]
      );
    }
  }, 30_000);
}

async function endSession(userId) {
  if (!sessionState.has(userId)) return;
  sessionState.delete(userId);
}
