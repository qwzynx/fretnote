# `src/lib/db-driver.ts`

**Role:** Opens the database, picks the right backend for the platform, creates/migrates the schema, and hands out a single shared connection via `getDb()`.
**Size:** 143 lines. **Depends on:** `@tauri-apps/plugin-sql` (lazy), `./db-driver.web` (lazy).

**This is the highest-value file in the repo to read closely.** In 143 lines it contains the platform abstraction, the entire schema, the migration strategy, a concurrency fix, and a data-repair pass — each with a comment explaining the bug that motivated it.

---

## `SqlDriver` — the abstraction

```ts
export interface SqlDriver {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}
```

Two methods. That's the entire surface the app needs from a database.

**Why the split:** `execute` for statements that change things (INSERT/UPDATE/DELETE/DDL), `select` for statements that return rows. Mirrors the Tauri SQL plugin's own API, which is why `Database.load()` can be returned from `createDriver()` with no adapter — it already satisfies this interface structurally. TypeScript's structural typing is doing real work here: the Tauri class never declares `implements SqlDriver`, it just happens to match.

**`execute` returns `Promise<unknown>`, not `void`.** The Tauri plugin returns `{ rowsAffected, lastInsertId }`; the web driver returns `undefined`. Rather than force one shape, the interface returns `unknown` — which means callers *can't* use the result without a cast. Look at `db.ts`: no caller ever does. Deliberate. The two backends genuinely disagree on this value, so making it unusable prevents code that works on desktop and silently breaks on web. `updateNote` in `db.ts` even does a separate `SELECT` to check existence rather than reading `rowsAffected`, precisely because of this.

**`select<T>` is generic and unvalidated.** The caller declares the row shape (`db.select<Row[]>(...)`) and nothing checks it. That's a deliberate trust boundary: the queries and the `Row` interfaces are both in `db.ts`, maintained together. Runtime validation would cost a pass over every row for a mismatch that a schema change would cause anyway.

**`bindValues?: unknown[]`** — optional, so parameterless queries read cleanly. `unknown[]` rather than a `SqlValue` union keeps callers from having to cast every number and string; the driver forwards them to SQLite, which does its own coercion.

### The header comment — the platform strategy

> *"Runtime-picks the storage backend the same way `export.ts` already does for clipboard/PDF: check `__TAURI_INTERNALS__` at call time rather than building two separate bundles."*

The decision: **one bundle, runtime detection** — not two build targets with `#ifdef`-style conditional compilation. Consequences worth understanding:

- One `npm run vite:build` output serves both the Tauri WebView and the browser deploy (`vercel.json` exists for exactly this).
- The branch is a runtime `if`, so **both** code paths must at least parse in both environments. That's why the imports are dynamic — see below.
- The same idiom appears in `export.ts` for clipboard and file-save. Recognising `"__TAURI_INTERNALS__" in window` as *the* platform check is worth doing once; it appears in several files.

---

## `_dbPromise` — the concurrency fix

```ts
let _dbPromise: Promise<SqlDriver> | null = null;
```

The doc comment above it is the single most instructive comment in the codebase:

> *"Caching the **promise** rather than the resolved driver is what makes `getDb()` safe to call concurrently: on phones three section pages mount at once and all call this in the same tick. Caching the value instead let each of them fall through the null check and build its own driver — two sql.js WASM instances bound to the same OPFS file, where the last flush silently wins."*

Work through why the obvious version is broken.

**Broken (cache the value):**
```ts
let _db: SqlDriver | null = null;
export async function getDb() {
  if (!_db) _db = await init();   // ← await yields control here
  return _db;
}
```
Three callers in the same tick. Caller A checks `_db` — null — and hits `await`, suspending. B and C run, both see `_db` still null (A hasn't assigned yet), and both start their own `init()`. Three databases. On the web driver that means three sql.js instances holding three independent in-memory copies of the same OPFS file, each flushing the whole database on write. Last writer wins; the other two callers' saves vanish. **A silent data-loss bug**, and the hardest kind to reproduce.

**Correct (cache the promise):**
```ts
if (!_dbPromise) _dbPromise = init();   // ← assignment is synchronous
return _dbPromise;
```
The assignment happens *before* any `await`. JavaScript is single-threaded and `getDb` has no `await` before the assignment, so B and C cannot interleave: they see a non-null `_dbPromise` and await the *same* promise. One `init()`, three callers, one driver.

**The general lesson:** in async JS, memoise the promise, not the result. The check-and-set must be in one synchronous block.

*"on phones three section pages mount at once"* — that's `SectionSwipe.svelte` keeping Feed, Setlists, and Settings all mounted for the swipe carousel. The bug was found on a real device, not in theory.

---

## `createDriver()` — the platform branch

```ts
async function createDriver(): Promise<SqlDriver> {
  if ("__TAURI_INTERNALS__" in window) {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    return Database.load("sqlite:fretnote.db");
  }
  const { createWebSqlDriver } = await import("@/lib/db-driver.web");
  return createWebSqlDriver();
}
```

### `if ("__TAURI_INTERNALS__" in window)`

`__TAURI_INTERNALS__` is a global the Tauri runtime injects into the WebView before any app code runs. Present ⇒ native shell; absent ⇒ plain browser.

**Why `in` and not `window.__TAURI_INTERNALS__`:** the `in` operator tests key existence without reading the value, so it needs no TypeScript declaration for an untyped global and can't trip on a falsy-but-present value. It's also the form Tauri's own docs use.

**Why check at call time, not at module load:** a module-level `const IS_TAURI = ...` would be evaluated during import, and import order relative to Tauri's injection isn't something you want to depend on. Checking inside the function guarantees the runtime has booted.

### The two dynamic `import()`s — this is the crux

Both branches use `await import(...)`, not top-level `import`. **This is required, not stylistic.**

A static `import Database from "@tauri-apps/plugin-sql"` would execute that module in the browser build too — where it would fail, or at minimum drag Tauri's IPC machinery into a bundle that can't use it. Symmetrically, a static import of `db-driver.web` would pull **sql.js and its ~1.5 MB WebAssembly binary** into the desktop build, which will never touch it.

Dynamic imports make each branch a separate lazily-fetched chunk. Vite code-splits on `import()` automatically. So:

- **Desktop:** loads the Tauri plugin chunk. The sql.js chunk is never requested; the WASM never downloads.
- **Browser:** loads the sql.js chunk. The Tauri chunk is never requested.

One bundle, but you only pay for the half you use. This is the mechanism that makes the "one build, runtime detection" strategy actually viable.

**`const { default: Database }`** — destructuring-with-rename, pulling the module's default export and binding it as `Database`. Necessary because `await import()` yields a module namespace object, not the default export.

**Note the asymmetry:** the Tauri branch returns `Database.load(...)` — a promise the outer `async` flattens. The web branch calls `createWebSqlDriver()`, a factory function. Different because the Tauri plugin ships a class with a static loader; the web driver needs its own async construction (see [`db-driver.web.ts`](db-driver.web.ts.md)).

**`"sqlite:fretnote.db"`** — the Tauri SQL plugin's URI scheme. A bare filename resolves inside the OS app-data directory (`~/.local/share/<bundle-id>/` on Linux, `%APPDATA%` on Windows, `~/Library/Application Support/` on macOS), so the path is correct per-platform without any path code.

**No `else`** — the Tauri branch returns, so the fallthrough *is* the else. Reads slightly flatter than an if/else.

---

## `addColumn()` — the migration primitive

```ts
async function addColumn(db: SqlDriver, ddl: string): Promise<void> {
  await db.execute(ddl).catch(() => {
    /* column already exists */
  });
}
```

> *"`ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS`, so adding is try/ignore."*

**The problem:** SQLite supports `CREATE TABLE IF NOT EXISTS` but *not* `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Running the same `ADD COLUMN` twice is an error. Since `init()` runs on every single app launch, every migration statement runs every launch — so the second launch onward would throw.

**The solution:** run it, swallow the failure. On first launch the column is added; on every launch after, the error means "already there" and is discarded.

**The honest cost:** `.catch(() => {})` swallows *all* errors, not just "duplicate column name." A typo'd DDL, a disk-full error, a locked database — all silently ignored, and the app then runs against a table missing a column, failing later somewhere confusing. The correct-but-verbose alternative is `PRAGMA table_info(notes)` and checking the column list first. This codebase chose brevity, and the comment is honest about what it's doing. Worth knowing when debugging: **if a column seems missing, this is where the error went.**

**Why a helper at all** — five call sites, each of which would otherwise need its own `.catch()`. The helper also *names* the pattern, so `addColumn(...)` reads as a migration rather than as an error being ignored.

---

## `init()` — schema, migrations, indexes, repair

Runs once per app launch. Six phases.

### Phase 1: open the connection

```ts
const db = await createDriver();
```

### Phase 2: `PRAGMA foreign_keys = ON`

```ts
await db.execute("PRAGMA foreign_keys = ON").catch(() => {});
```

> *"Requested per connection, not per database. The Tauri plugin pools connections, so this can't be relied on — `deleteNote`/`deleteSetlist` clean up `setlist_items` explicitly instead. Kept because it does hold on the single-connection web driver, and costs nothing where it doesn't."*

**The gotcha:** SQLite defaults foreign-key enforcement to *off* for backwards compatibility, and the pragma is **per connection**, not stored in the database file. The Tauri plugin maintains a connection *pool* — so this pragma applies to whichever connection happened to serve this call, and a later `DELETE` may run on a different connection with enforcement off.

**The consequence:** `ON DELETE CASCADE` in the `setlist_items` DDL below is **not reliable on desktop**. That's why `deleteNote` in `db.ts` manually deletes memberships first. The declared cascade is documentation plus a real safety net on web, not the actual mechanism.

**Why keep it:** it genuinely works on the single-connection web driver, and costs one no-op statement where it doesn't. The `.catch(() => {})` covers backends that reject pragmas.

This is a good example of a comment that saves you an hour: without it you'd read the cascade in the DDL, read the manual delete in `db.ts`, and conclude one of them is redundant.

### Phase 3: `CREATE TABLE IF NOT EXISTS notes`

```sql
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
```

Map this against [`types.ts`](types.ts.md)'s `Note` — the correspondence is close, with four deliberate differences:

| Type field | Column | Note |
|---|---|---|
| `tags: string[]` | `tags TEXT DEFAULT '[]'` | JSON in a TEXT column |
| `chords: string[]` | `chords TEXT DEFAULT '[]'` | JSON |
| `tabBlocks?: TabBlock[]` | `tab_blocks TEXT` | JSON, nullable |
| `strummingPattern?` | `strumming_pattern TEXT` | JSON, nullable |
| `createdAt: string` | `created_at TEXT` | ISO string, sorts chronologically |
| `isFavorite?: boolean` | *(migration)* | `INTEGER`; SQLite has no boolean |

**Naming:** `snake_case` in SQL, `camelCase` in TypeScript. The translation is `rowToSummary`/`rowToNote` in `db.ts` — which is the *only* reason those mapping functions exist. Matching names would let you spread the row directly; the split keeps each language idiomatic at the cost of one mapping function.

**Why JSON in TEXT columns rather than proper relational tables:** a `note_tags` join table would be the normalised design. This app is local-first, single-user, with a few hundred notes; there are no queries that filter by tag *in SQL* (filtering happens in JS in `FeedClient.svelte`). JSON blobs keep the schema to three tables and let a whole note round-trip in one row — which is also what makes `.fretnote` export/import in `backup.ts` trivial.

**`NOT NULL DEFAULT '[]'`** on the two array columns is the important detail: it means `parseJsonColumn` never sees `NULL` for them, so `tags` and `chords` are always arrays. The nullable ones (`tab_blocks`, `strumming_pattern`) map to `undefined`, matching their optionality in the type.

**`slug TEXT UNIQUE NOT NULL`** — the UNIQUE constraint creates an implicit index, which is what makes the slug lookup in `getNote` fast.

**`key`** is a SQLite keyword-adjacent word but not reserved, so it works unquoted. Slightly risky naming; it survives because SQLite is lenient.

### Phase 4: incremental migrations

```ts
await addColumn(db, `ALTER TABLE notes ADD COLUMN strumming_pattern TEXT`);
await addColumn(db, `ALTER TABLE notes ADD COLUMN bpm INTEGER`);
await addColumn(db, `ALTER TABLE notes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`);
await addColumn(db, `ALTER TABLE notes ADD COLUMN tuning TEXT NOT NULL DEFAULT 'standard'`);
await addColumn(db, `ALTER TABLE notes ADD COLUMN updated_at TEXT`);
```

**This is the app's version history, readable top to bottom.** Each line is a release that added a feature: strumming patterns, then BPM, then favourites, then per-note tuning, then edit timestamps.

**Note the redundancy:** `strumming_pattern` and `bpm` appear *both* in the `CREATE TABLE` above *and* here. That's correct and necessary:
- **Fresh install:** `CREATE TABLE` includes them; the `ALTER` fails and is swallowed.
- **Existing install:** the table already exists so `CREATE TABLE IF NOT EXISTS` is a no-op; the `ALTER` is what actually adds the column.

Both paths converge on the same schema. The three later columns (`is_favorite`, `tuning`, `updated_at`) are *not* in the `CREATE TABLE`, so even fresh installs get them via `ALTER`. Slightly inconsistent, but harmless — and it's the natural residue of adding columns over time without rewriting the base DDL.

**There is no version number.** No `PRAGMA user_version`, no migrations table. The strategy is "declare the desired state idempotently and run it every launch." Simple and robust for an append-only schema; it would not survive a migration that needs to *transform* data or drop a column. Fine for this app's trajectory.

**`tuning ... DEFAULT 'standard'`** with its comment:
> *"The editor has always had a tuning picker; until now its value was dropped on save, so every existing row predates the column."*

A bug being fixed, not just a feature added — the UI existed and silently discarded the value.

### Phase 5: the `updated_at` backfill

```ts
await db
  .execute(`UPDATE notes SET updated_at = created_at WHERE updated_at IS NULL`)
  .catch(() => {});
```

> *"Backfill rather than default, so 'recently edited' starts out meaning 'created' instead of 'all at once, the day you upgraded'."*

**Why not `ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`:** that would stamp every existing row with the *upgrade date*. Sorting by "recently edited" would then show your whole library tied for first place, ordered arbitrarily — the feature would be useless for exactly the users who have the most notes.

**The `WHERE updated_at IS NULL` clause makes it idempotent.** It runs on every launch, but after the first pass no rows match, so it's a cheap indexed no-op. Crucially it also means a note you actually edit is never re-stamped back to its creation date on the next launch — without that clause, this line would silently destroy edit history every time the app started.

This is a small decision that shows real care about what the data *means*, not just its shape.

### Phase 6: `setlists` and `setlist_items`

```sql
CREATE TABLE IF NOT EXISTS setlists (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setlist_items (
  id          TEXT PRIMARY KEY,
  setlist_id  TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  note_id     TEXT NOT NULL REFERENCES notes(id)    ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0
);
```

A textbook **many-to-many join table**: a note can be in many setlists, a setlist holds many notes.

**`position INTEGER`** is what makes a setlist an *ordered* list rather than a set — essential for the domain (a gig setlist has a running order). Reordering is a matter of rewriting positions.

**`ON DELETE CASCADE` on both FKs** — declared, but per Phase 2, **only enforced when the pragma holds on that connection**. On desktop, treat it as documentation; `db.ts` does the cleanup manually.

**`description TEXT NOT NULL DEFAULT ''`** matches the required `description: string` in `types.ts` — empty string rather than null, so nothing has to null-check at render.

### Phase 7: indexes

```sql
CREATE INDEX IF NOT EXISTS idx_notes_created_at        ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at        ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_setlist_items_setlist   ON setlist_items(setlist_id, position);
CREATE INDEX IF NOT EXISTS idx_setlist_items_note      ON setlist_items(note_id);
```

> *"The feed orders by `created_at` on every load; `setlist_items` is joined and filtered on both foreign keys. Without these every one of those is a full scan, and an unindexed FK also makes each cascade delete scan the child table."*

Each one is justified by a specific query:

- **`idx_notes_created_at DESC`** — serves `ORDER BY created_at DESC` in `listNoteSummaries`, the feed's query. The `DESC` in the index definition matches the query's direction, so SQLite can walk it forward instead of sorting.
- **`idx_notes_updated_at DESC`** — the "recently edited" sort option.
- **`idx_setlist_items_setlist(setlist_id, position)`** — a **composite** index, and the column order is the point: filter by `setlist_id`, then read rows already in `position` order. One index serves both the WHERE and the ORDER BY, so fetching a setlist needs no sort at all.
- **`idx_setlist_items_note`** — serves `WHERE note_id = ?` in `deleteNote`. The comment's second clause is the subtle part: **SQLite does not automatically index foreign keys**, so every cascade (or manual cleanup) delete would scan the entire join table.

No index on `id` or `slug` — `PRIMARY KEY` and `UNIQUE` create them implicitly.

### Phase 8: the orphan repair

```ts
await db.execute(
  `DELETE FROM setlist_items
    WHERE note_id NOT IN (SELECT id FROM notes)
       OR setlist_id NOT IN (SELECT id FROM setlists)`
).catch(() => {});
```

> *"Foreign keys went unenforced for every release so far, so libraries that have ever had a note deleted are carrying rows pointing at nothing. They are invisible on the setlist page (the JOIN drops them) but counted by `listSetlists`, which is why a card could read '8 songs' over 7 rows."*

**This is a data-repair migration, and the comment is a complete bug report.** Read it as a story:

1. `ON DELETE CASCADE` was declared but never enforced (Phase 2's pragma problem).
2. Deleting a note left its `setlist_items` rows behind, pointing at a nonexistent note.
3. The setlist *detail* page uses a JOIN, which silently drops orphans — so the page looked fine.
4. `listSetlists` computes `noteCount` with `COUNT(*)` on `setlist_items` — **no join** — so it counted the orphans.
5. Result: a card reading "8 songs" above a list of 7. A user-visible inconsistency with an invisible cause.

The fix runs once per launch and is idempotent (after the first pass nothing matches). `NOT IN (SELECT ...)` is a correlated-free subquery, cheap here because both are indexed primary-key scans over small tables.

**Note this only heals data; it doesn't prevent recurrence.** The prevention is the explicit cleanup in `deleteNote`. Belt and braces: fix the past, then close the hole.

---

## `getDb()` — the public entry point

```ts
export async function getDb(): Promise<SqlDriver> {
  if (!_dbPromise) {
    _dbPromise = init().catch((err) => {
      _dbPromise = null;
      throw err;
    });
  }
  return _dbPromise;
}
```

The only export besides the interface. Everything in `db.ts`, `setlists.ts`, and `backup.ts` starts with `const db = await getDb()`.

### `if (!_dbPromise)`

The memoisation check. As analysed above, the fact that the assignment on the next line is synchronous — no `await` between the check and the set — is what makes this safe against concurrent callers.

### `.catch(err => { _dbPromise = null; throw err })` — negative caching, avoided

> *"Don't cache a failed init — otherwise a transient failure (no OPFS yet, file locked) poisons the app until it restarts, and the retry offered by the error screen could never succeed."*

Without this, a rejected promise stays in `_dbPromise` forever. Every subsequent `getDb()` returns that same rejected promise, so the "Retry" button on the error screen would re-fail instantly, with no attempt made. **The retry UI would be a lie.**

Resetting to `null` in the catch means the next call re-enters `init()` for real.

**The `throw err` is essential.** `.catch()` returns a *new* promise; if the handler returned normally, that promise would **resolve** with `undefined`, and the caller would get `undefined` instead of a driver — turning a clear failure into `Cannot read property 'select' of undefined` somewhere far away. Re-throwing keeps the returned promise rejected so the caller's own `try`/`catch` fires.

**Subtle detail:** the value stored in `_dbPromise` is the promise returned by `.catch(...)`, not the raw `init()` promise. That's what's shared between concurrent callers, and it's the one that rejects properly. The `_dbPromise = null` inside runs before the re-throw, so by the time any caller observes the rejection, the slot is already cleared and ready for a retry.

### `return _dbPromise`

Returned inside an `async` function, so it's awaited and flattened. Every caller gets the same underlying driver instance.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `if ("__TAURI_INTERNALS__" in window)` | `createDriver` | Desktop vs. browser backend |
| `await import()` ×2 | `createDriver` | Code-split so each platform only downloads its own backend |
| `.catch(() => {})` | `addColumn` | `ADD COLUMN` has no `IF NOT EXISTS` — run-and-ignore |
| `.catch(() => {})` | pragma, backfill, orphan purge | Best-effort steps that must not block startup |
| `WHERE updated_at IS NULL` | backfill | Idempotence — and prevents destroying real edit times |
| `IF NOT EXISTS` ×7 | tables + indexes | Idempotence for the whole DDL |
| `if (!_dbPromise)` | `getDb` | Promise memoisation — the concurrency fix |
| `.catch(reset; rethrow)` | `getDb` | Avoid negative caching so retry can work |

No loops. Everything is sequential `await`s — deliberately, since the migrations are order-dependent (create before alter before backfill before index before repair).

---

## Suggested experiments

1. Comment out the `WHERE updated_at IS NULL` in the backfill, edit a note, restart. Watch the edit time revert.
2. Change `if (!_dbPromise)` to cache the resolved value instead, then load the app on a narrow viewport where three sections mount. Reproduce the multi-instance bug.
3. Force `createDriver()` down the web branch on desktop and watch the OPFS driver take over.
4. Delete a note that's in a setlist with the `deleteNote` cleanup line removed — then restart and watch Phase 8 repair it.

---

## Related

- [`lib/db-driver.web.ts`](db-driver.web.ts.md) — the sql.js/OPFS backend
- [`lib/db.ts`](db.ts.md) — every query that runs against this schema
- [`lib/types.ts`](types.ts.md) — the TypeScript mirror of this DDL
- [`lib/setlists.ts`](setlists.ts.md) — the `noteCount` query the orphan purge fixes
- [`scripts/verify-schema.mjs`](../scripts/verify-schema.mjs.md) — the check that guards this schema
