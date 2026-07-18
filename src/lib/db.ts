import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const conn = process.env.DATABASE_URL;

const pool =
  global.__pgPool ??
  new Pool({
    connectionString: conn,
    max: 5,
    ssl:
      conn && !conn.includes("railway.internal")
        ? { rejectUnauthorized: false }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

// Base tables + idempotent migrations. Safe to run on every cold start.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  tg_username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_played DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rounds (
  id SERIAL PRIMARY KEY,
  asset TEXT NOT NULL,
  round_date DATE NOT NULL,
  close_at TIMESTAMPTZ NOT NULL,
  settle_at TIMESTAMPTZ NOT NULL,
  settle_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  UNIQUE (asset, round_date)
);
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guess NUMERIC NOT NULL,
  error_pct NUMERIC,
  points INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, player_id)
);

-- migrations (idempotent) --
ALTER TABLE players ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS timeframe TEXT NOT NULL DEFAULT '24h';
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_asset_round_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_round ON rounds(asset, timeframe, close_at);

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS timeframe TEXT NOT NULL DEFAULT '24h';
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS charged INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_predictions_round ON predictions(round_id);
CREATE INDEX IF NOT EXISTS idx_predictions_player ON predictions(player_id);
`;

let ready: Promise<void> | null = null;

export function db(): Promise<Pool> {
  if (!ready) {
    ready = pool.query(SCHEMA).then(() => undefined);
  }
  return ready.then(() => pool);
}
