CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  ac_balance INTEGER NOT NULL DEFAULT 0,
  ac_pending_locked INTEGER NOT NULL DEFAULT 0,
  lifetime_ac_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    CREATE TYPE tx_type AS ENUM ('redeem', 'adjust');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_source') THEN
    CREATE TYPE tx_source AS ENUM ('mod');
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

CREATE TABLE IF NOT EXISTS bot_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
