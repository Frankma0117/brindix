import type Database from 'better-sqlite3';

/**
 * What the standalone app adds around the publisher module (whose own tables are in
 * publisher.schema.ts): the library of files to publish, the panel's sessions and the text model's
 * usage. Idempotent, runs at every boot.
 */
export function initAppSchema(db: Database.Database): void {
  db.exec(`
    -- The files the project publishes: uploaded by hand, or pushed by the project's own software (API).
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media TEXT NOT NULL CHECK (media IN ('image', 'video')),
      title TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      file_ref TEXT NOT NULL,
      thumb_ref TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'url', 'api')),
      ref TEXT NOT NULL DEFAULT '',               -- the project's own id (pushing the same ref twice doesn't duplicate)
      used_count INTEGER NOT NULL DEFAULT 0,      -- times the automation picked it
      last_used_at TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),  -- pending = waiting for the administrator to validate it
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_ref ON assets(ref) WHERE ref != '';

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Databases created before the «Por validar» tray.
  const cols = db.prepare('PRAGMA table_info(assets)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'status')) db.exec("ALTER TABLE assets ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'");
}
