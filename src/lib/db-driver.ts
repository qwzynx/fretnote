// Runtime-picks the storage backend the same way export.ts already does for
// clipboard/PDF: check `__TAURI_INTERNALS__` at call time rather than
// building two separate bundles. Desktop keeps its native SQLite file; the
// browser gets a sql.js (SQLite-via-WASM) database persisted to OPFS.
export interface SqlDriver {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

/**
 * The in-flight or settled init. Caching the *promise* rather than the
 * resolved driver is what makes `getDb()` safe to call concurrently: on
 * phones three section pages mount at once and all call this in the same
 * tick. Caching the value instead let each of them fall through the null
 * check and build its own driver — two sql.js WASM instances bound to the
 * same OPFS file, where the last flush silently wins.
 */
let _dbPromise: Promise<SqlDriver> | null = null;

async function createDriver(): Promise<SqlDriver> {
  if ("__TAURI_INTERNALS__" in window) {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    return Database.load("sqlite:fretnote.db");
  }
  const { createWebSqlDriver } = await import("@/lib/db-driver.web");
  return createWebSqlDriver();
}

/** `ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS`, so adding is try/ignore. */
async function addColumn(db: SqlDriver, ddl: string): Promise<void> {
  await db.execute(ddl).catch(() => {
    /* column already exists */
  });
}

async function init(): Promise<SqlDriver> {
  const db = await createDriver();

  // Requested per connection, not per database. The Tauri plugin pools
  // connections, so this can't be relied on — deleteNote/deleteSetlist clean
  // up setlist_items explicitly instead. Kept because it does hold on the
  // single-connection web driver, and costs nothing where it doesn't.
  await db.execute("PRAGMA foreign_keys = ON").catch(() => {});

  await db.execute(`
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
  await addColumn(db, `ALTER TABLE notes ADD COLUMN strumming_pattern TEXT`);
  await addColumn(db, `ALTER TABLE notes ADD COLUMN bpm INTEGER`);
  await addColumn(
    db,
    `ALTER TABLE notes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`
  );
  // The editor has always had a tuning picker; until now its value was
  // dropped on save, so every existing row predates the column.
  await addColumn(
    db,
    `ALTER TABLE notes ADD COLUMN tuning TEXT NOT NULL DEFAULT 'standard'`
  );
  await addColumn(db, `ALTER TABLE notes ADD COLUMN updated_at TEXT`);
  // Backfill rather than default, so "recently edited" starts out meaning
  // "created" instead of "all at once, the day you upgraded".
  await db
    .execute(`UPDATE notes SET updated_at = created_at WHERE updated_at IS NULL`)
    .catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS setlists (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS setlist_items (
      id          TEXT PRIMARY KEY,
      setlist_id  TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
      note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0
    )
  `);

  // The feed orders by created_at on every load; setlist_items is joined and
  // filtered on both foreign keys. Without these every one of those is a full
  // scan, and an unindexed FK also makes each cascade delete scan the child
  // table.
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_setlist_items_setlist ON setlist_items(setlist_id, position)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_setlist_items_note ON setlist_items(note_id)`
  );

  // Foreign keys went unenforced for every release so far, so libraries that
  // have ever had a note deleted are carrying rows pointing at nothing. They
  // are invisible on the setlist page (the JOIN drops them) but counted by
  // listSetlists, which is why a card could read "8 songs" over 7 rows.
  await db
    .execute(
      `DELETE FROM setlist_items
        WHERE note_id NOT IN (SELECT id FROM notes)
           OR setlist_id NOT IN (SELECT id FROM setlists)`
    )
    .catch(() => {});

  return db;
}

export async function getDb(): Promise<SqlDriver> {
  if (!_dbPromise) {
    _dbPromise = init().catch((err) => {
      // Don't cache a failed init — otherwise a transient failure (no OPFS
      // yet, file locked) poisons the app until it restarts, and the retry
      // offered by the error screen could never succeed.
      _dbPromise = null;
      throw err;
    });
  }
  return _dbPromise;
}
