// Runtime-picks the storage backend the same way export.ts already does for
// clipboard/PDF: check `__TAURI_INTERNALS__` at call time rather than
// building two separate bundles. Desktop keeps its native SQLite file; the
// browser gets a sql.js (SQLite-via-WASM) database persisted to OPFS.
export interface SqlDriver {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

let _db: SqlDriver | null = null;

async function createDriver(): Promise<SqlDriver> {
  if ("__TAURI_INTERNALS__" in window) {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    return Database.load("sqlite:fretnote.db");
  }
  const { createWebSqlDriver } = await import("@/lib/db-driver.web");
  return createWebSqlDriver();
}

export async function getDb(): Promise<SqlDriver> {
  if (!_db) {
    _db = await createDriver();
    await _db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id                TEXT PRIMARY KEY,
        slug              TEXT UNIQUE NOT NULL,
        type              TEXT NOT NULL,
        title             TEXT NOT NULL,
        artist            TEXT NOT NULL,
        key               TEXT NOT NULL,
        capo              INTEGER NOT NULL DEFAULT 0,
        difficulty        TEXT NOT NULL DEFAULT 'beginner',
        tags              TEXT NOT NULL DEFAULT '[]',
        created_at        TEXT NOT NULL,
        chord_sheet       TEXT,
        tab_blocks        TEXT,
        chords            TEXT NOT NULL DEFAULT '[]',
        strumming_pattern TEXT,
        bpm               INTEGER
      )
    `);
    await _db.execute(
      `ALTER TABLE notes ADD COLUMN strumming_pattern TEXT`
    ).catch(() => { /* column already exists */ });
    await _db.execute(
      `ALTER TABLE notes ADD COLUMN bpm INTEGER`
    ).catch(() => { /* column already exists */ });
    await _db.execute(
      `ALTER TABLE notes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`
    ).catch(() => { /* column already exists */ });
    await _db.execute(`
      CREATE TABLE IF NOT EXISTS setlists (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL
      )
    `);
    await _db.execute(`
      CREATE TABLE IF NOT EXISTS setlist_items (
        id          TEXT PRIMARY KEY,
        setlist_id  TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
        note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        position    INTEGER NOT NULL DEFAULT 0
      )
    `);
  }
  return _db;
}
