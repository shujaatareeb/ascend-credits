-- Upgrade for pre-wallet schema to wallet/redeem-only model

-- Remove old engagement tables if they still exist
DROP TABLE IF EXISTS leaderboard_snapshots;
DROP TABLE IF EXISTS message_events;
DROP TABLE IF EXISTS voice_sessions;

-- Remove old engagement columns if they still exist
ALTER TABLE users
  DROP COLUMN IF EXISTS monthly_ac_earned,
  DROP COLUMN IF EXISTS monthly_voice_minutes_valid,
  DROP COLUMN IF EXISTS monthly_message_count_valid;

-- Ensure required wallet columns exist
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ac_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ac_pending_locked INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_ac_earned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure redemption status enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'redemption_status') THEN
    CREATE TYPE redemption_status AS ENUM ('requested', 'confirmed', 'approved', 'denied', 'closed');
  END IF;
END$$;

-- Ensure transaction enums exist; if existing enums have extra legacy values, keep them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
    CREATE TYPE tx_type AS ENUM ('redeem', 'adjust');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_source') THEN
    CREATE TYPE tx_source AS ENUM ('mod');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_status') THEN
    CREATE TYPE tx_status AS ENUM ('pending', 'success', 'failed');
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

CREATE TABLE IF NOT EXISTS bot_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_redemption_tickets_status ON redemption_tickets(status);
CREATE INDEX IF NOT EXISTS idx_redemption_tickets_user_id ON redemption_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);
