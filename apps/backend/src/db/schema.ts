import type Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE,
      apple_id      TEXT UNIQUE,
      password_hash TEXT,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL,
      expires_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store       TEXT,
      date        TEXT,
      total       REAL,
      currency    TEXT NOT NULL DEFAULT 'EUR',
      tax         REAL,
      image_url   TEXT,
      raw_ocr     TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id           TEXT PRIMARY KEY,
      receipt_id   TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      description  TEXT,
      quantity     REAL,
      unit_price   REAL,
      total        REAL
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_date    ON receipts(date);
    CREATE INDEX IF NOT EXISTS idx_refresh_user     ON refresh_tokens(user_id);
  `);
}
