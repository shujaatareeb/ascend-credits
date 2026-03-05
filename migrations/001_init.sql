CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  ac_balance INTEGER NOT NULL DEFAULT 0,
  ac_pending_locked INTEGER NOT NULL DEFAULT 0,
  monthly_ac_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_ac_earned INTEGER NOT NULL DEFAULT 0,
  monthly_voice_minutes_valid INTEGER NOT NULL DEFAULT 0,
  monthly_message_count_valid INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_sessions (
  session_id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  channel_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  valid_minutes INTEGER NOT NULL DEFAULT 0,
  speaking_events_count INTEGER NOT NULL DEFAULT 0,
  was_valid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_events (
  event_id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  message_hash TEXT,
  length_int INTEGER NOT NULL,
  was_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  rewarded_ac INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_items (
  item_id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  description TEXT,
  denomination_label TEXT NOT NULL,
  original_price_inr_numeric NUMERIC(10, 2) NOT NULL,
  discounted_price_inr_numeric NUMERIC(10, 2) NOT NULL,
  cost_ac INTEGER NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  active_boolean BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'redemption_status') THEN
    CREATE TYPE redemption_status AS ENUM ('requested', 'confirmed', 'approved', 'denied', 'closed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS redemption_tickets (
  ticket_id BIGSERIAL PRIMARY KEY,
  discord_channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  item_id TEXT NOT NULL REFERENCES stock_items(item_id),
  cost_ac INTEGER NOT NULL,
  status redemption_status NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by_user_id TEXT,
  notes_text TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
    CREATE TYPE tx_type AS ENUM ('earn', 'redeem', 'adjust');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_source') THEN
    CREATE TYPE tx_source AS ENUM ('voice', 'text', 'mod');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_status') THEN
    CREATE TYPE tx_status AS ENUM ('success', 'failed', 'pending');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  type tx_type NOT NULL,
  source tx_source NOT NULL,
  amount_ac INTEGER NOT NULL,
  reference_id TEXT,
  status tx_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  snapshot_id BIGSERIAL PRIMARY KEY,
  month_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  monthly_ac_earned INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
