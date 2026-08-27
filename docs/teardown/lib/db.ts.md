# `src/lib/db.ts`

**Role:** Every SQL query for the `notes` table, plus the row⇄object mapping. The data-access layer.
**Size:** 292 lines. **Depends on:** `./db-driver` (for `getDb`), `./types`.

Setlist queries live separately in [`setlists.ts`](setlists.ts.md). This file is notes only.

---

## Structure

The file is divided by comment banners into three sections — **Read**, **Write**, **Helpers** — and that ordering is deliberate: public API first, mapping plumbing last. Functions are used before they're defined (`listNoteSummaries` calls `rowToSummary` 230 lines later), which works because function declarations hoist.

Every public function opens with `const db = await getDb()`. There is no connection passed around and no transaction object. That's the whole concurrency model: one memoised driver, awaited per call.

---

# ── Read ──

## `SUMMARY_COLUMNS`

```ts
const SUMMARY_COLUMNS = `id, slug, type, title, artist, key, capo, difficulty,
  tags, created_at, updated_at, tuning, chords, strumming_pattern, bpm, is_favorite`;
```

**Every column except `chord_sheet` and `tab_blocks`.** This constant is the SQL-side counterpart to `NoteSummary` in [`types.ts`](types.ts.md) — the type is `Omit<Note, "chordSheet" | "tabBlocks">`, and this list is that omission expressed in SQL.

**Keeping the two in sync is manual.** Add a column to `Note` and you must touch three places: the DDL in `db-driver.ts`, this string, and `SummaryRow` below. Nothing catches a mismatch except a runtime `undefined`. It's the most fragile seam in the data layer, and worth remembering when you add a field.

Extracted to a constant because it's interpolated into one query — arguably it could be inlined, but naming it is what makes the "summary vs. full" distinction visible at a glance.

---

## `listNoteSummaries()`

```ts
export async function listNoteSummaries(): Promise<NoteSummary[]> {
  const db = await getDb();
  const rows = await db.select<SummaryRow[]>(
    `SELECT ${SUMMARY_COLUMNS} FROM notes ORDER BY created_at DESC`
  );
  return rows.map(rowToSummary);
}
```

> *"The feed's list query. Reads only what a card renders: pulling `chord_sheet` and `tab_blocks` too meant every keystroke-filtered list carried the full text of every song, and `rowToNote` parsed four JSON columns per row to throw most of it away."*

**This is a performance fix preserved as a comment, and it's worth understanding fully.** The feed re-renders as the user types in the filter box. With `SELECT *`:

1. Every row carried the complete lyrics and every tab of every song — potentially megabytes of text, marshalled across the Tauri IPC boundary or copied out of the WASM heap.
2. `rowToNote` ran `JSON.parse` on **four** columns per row (`tags`, `chords`, `strumming_pattern`, `tab_blocks`), then the card discarded the two expensive ones.

Now it's two `JSON.parse` calls per row over short arrays, and the body blobs never leave SQLite.

**`ORDER BY created_at DESC`** — newest first, backed by `idx_notes_created_at DESC` from `db-driver.ts`. The index's declared direction matches the query's, so SQLite walks the index rather than sorting.

**`rows.map(rowToSummary)`** — one loop, converting snake_case DB rows to camelCase domain objects. This mapping exists *only* because the two naming conventions differ; see the Helpers section.

**No `LIMIT`.** The entire library loads at once. Fine at personal-songbook scale (hundreds of notes) and it's what makes client-side filtering in `FeedClient.svelte` instant. It's the scaling limit of the design, consciously accepted — the same tradeoff as sql.js holding the whole database in memory.

---

## `listNotes()`

```ts
export async function listNotes(): Promise<Note[]> {
  const db = await getDb();
  const rows = await db.select<Row[]>("SELECT * FROM notes ORDER BY created_at DESC");
  return rows.map(rowToNote);
}
```

> *"Full notes including bodies. Only export and backup need this."*

The heavy version, kept deliberately separate rather than adding a boolean parameter. The comment names its only legitimate callers ([`export.ts`](export.ts.md), [`backup.ts`](backup.ts.md)) — both of which genuinely need every byte, because they're serialising the library to a file.

**Two functions instead of `listNotes(includeBodies: boolean)`.** The flag version would return a union type that every caller has to narrow, and would make the expensive path the easy default. Two names with two return types means the type system tells you which you got, and reaching for the expensive one is a visible decision.

`SELECT *` is acceptable here precisely *because* it wants everything — the column list can't drift out of sync.

---

## `getNote(idOrSlug)`

```ts
export async function getNote(idOrSlug: string): Promise<Note | null> {
  const db = await getDb();
  const byId = await db.select<Row[]>("SELECT * FROM notes WHERE id = $1 LIMIT 1", [idOrSlug]);
  if (byId.length) return rowToNote(byId[0]);

  const bySlug = await db.select<Row[]>("SELECT * FROM notes WHERE slug = $1 LIMIT 1", [idOrSlug]);
  if (bySlug.length) return rowToNote(bySlug[0]);

  return null;
}
```

> *"Two indexed equality lookups rather than `WHERE id = $1 OR slug = $1`. SQLite won't use the primary key or the unique index across an OR spanning two columns, so the single-query form scanned the whole table — reading every song's lyrics — on every note open and every edit load."*

**A genuine query-planner lesson, and one of the best comments in the repo.**

The intuitive query is one round trip:
```sql
SELECT * FROM notes WHERE id = $1 OR slug = $1
```
Both columns are indexed (`PRIMARY KEY`, `UNIQUE`), so it *looks* fast. It isn't. SQLite's planner will not combine two separate indexes across an `OR` on different columns — it falls back to a **full table scan**. And because this is `SELECT *`, that scan reads the lyrics and tab blocks of every song in the library, on every note open.

Splitting into two single-column equality lookups lets each one use its index. Cost: a second round trip in the slug case. Benefit: O(log n) instead of O(n × row size).

### The two `if` statements

**`if (byId.length)`** — truthiness on `.length`, meaning "at least one row." Idiomatic, though `> 0` would be more explicit.

The order matters: **ID is tried first.** IDs are UUIDs and slugs are `title-artist-xxxxx`, so a collision is effectively impossible — but checking the primary key first is the cheaper lookup, and it means an ID never pays for a slug query.

**The early-return structure** avoids nesting. Each check either returns or falls through to the next attempt, ending at `return null`.

### `LIMIT 1`

Both columns are unique, so at most one row can match. The `LIMIT` is redundant for correctness but tells SQLite it can stop after the first hit — a real saving on the slug query in particular.

### `Promise<Note | null>`

Returns `null`, not a throw, for "not found." Correct choice: a missing note is a normal outcome (a stale URL, a deleted note), not an exceptional one. The `| null` in the type forces callers to handle it — `NotePage.svelte` shows a not-found state rather than crashing.

### `$1` placeholders

Parameterised, never interpolated. That's SQL-injection-safe by construction. Note the `$N` style rather than `?` — both work in SQLite; `$N` is what the Tauri plugin's docs use, and it makes the mapping to the values array explicit at a glance in the longer INSERT statements below.

---

# ── Write ──

## `NoteInput`

```ts
export interface NoteInput {
  type; title; artist; key; capo; difficulty; tags; tuning;
  chordSheet?; tabBlocks?; chords; strummingPattern?; bpm?;
}
```

`Note` **minus** `id`, `slug`, `createdAt`, `updatedAt`, `isFavorite`.

**The omissions are the point.** Those five fields are not the caller's to supply:

| Field | Owned by |
|---|---|
| `id` | `createNote` (`crypto.randomUUID()`) |
| `slug` | `createNote` (`makeSlug`) |
| `createdAt` / `updatedAt` | `createNote` / `updateNote` (server-of-record timestamps) |
| `isFavorite` | `toggleFavorite`, a separate operation |

So a form cannot fabricate an ID, backdate a note, or silently un-favourite a song while editing it. **This is why `updateNote` can't clobber `is_favorite`** — the field isn't in the input type, so the UPDATE statement simply doesn't mention it. Type-level protection against a real bug class.

Note it's written out longhand rather than as `Omit<Note, ...>`. Slightly more to maintain than `NoteSummary`'s derivation, but it makes the create/edit contract readable in one place.

---

## `createNote(input)`

```ts
const id = crypto.randomUUID();
const slug = makeSlug(input.title, input.artist);
const now = new Date().toISOString();
```

**`crypto.randomUUID()`** — the Web Crypto API, available in both the Tauri WebView and browsers. A v4 UUID, generated client-side. No server, no autoincrement — which is exactly what makes the `.fretnote` export/import model work: two devices can create notes independently and never collide, so import is a straight upsert by ID.

**`const now` computed once and used twice** (lines 98–99, `created_at` and `updated_at`). Two separate `new Date()` calls could produce different milliseconds, leaving a note that appears edited the instant it was created. Small, but it would corrupt "recently edited" ordering.

### The INSERT and its value array

17 columns, 17 placeholders, 17 values in matching order. Four of the values do real work:

**`JSON.stringify(input.tags)` and `JSON.stringify(input.chords)`** — unconditional, because both columns are `NOT NULL DEFAULT '[]'`. An empty array becomes `"[]"`, never `NULL`. That guarantee is what lets `rowToSummary` treat them as always-arrays.

**`input.chordSheet ?? null`** — nullish coalescing. `undefined` isn't a valid SQL bind value; `null` is. Note it's `??` not `||`, which matters: `||` would convert an **empty string to `NULL`**, losing the distinction between "a chord note with an empty body" and "no body at all."

**`input.tabBlocks?.length ? JSON.stringify(...) : null`** — the most interesting line in the function.

Read the condition carefully. `?.length` is optional chaining, so it yields `undefined` when `tabBlocks` is `undefined`, and `0` when it's `[]`. **Both are falsy**, so both store `NULL`.

The effect: an empty array and a missing array are stored identically. That's a deliberate normalisation — without it the column would hold `"[]"` for a chords-only note, and `rowToNote` would produce `tabBlocks: []` instead of `undefined`, so `{#if note.tabBlocks}` would render an empty tab section. Storing `NULL` collapses "none" into one representation.

Same pattern for `strummingPattern`. Contrast with `tags`/`chords`, which take the opposite approach (always an array, never null) — the difference tracks the column's `NOT NULL` declaration in the DDL, so the two files agree.

**`input.bpm ?? null`** — again `??` not `||`, and here it genuinely matters: `bpm: 0` is falsy, and `||` would silently discard it.

### The return

```ts
return { id, slug, createdAt: now, updatedAt: now, ...input };
```

Constructs the `Note` **in memory** rather than re-reading the row. Saves a round trip, and it's safe because every value was just written.

**Spread order:** the generated fields come first, `...input` last. Since `NoteInput` can't contain `id`/`slug`/`createdAt`/`updatedAt`, nothing is overwritten — but if the type ever gained one of those, the spread would win. Putting the generated fields *after* the spread would be the more defensive ordering.

**`isFavorite` is absent** from the returned object — undefined, and the column defaults to `0`. Consistent, since a new note isn't favourited.

---

## `updateNote(id, input)`

```ts
const existing = await db.select<{ id: string }[]>(
  "SELECT id FROM notes WHERE id = $1 LIMIT 1", [id]
);
if (!existing.length) return false;
```

> *"Resolves false when no row matched, so callers can surface 'not found'."*

**Why a separate existence query instead of checking rows-affected:** because `SqlDriver.execute` returns `Promise<unknown>`. The Tauri plugin gives you `{ rowsAffected }`; the sql.js driver returns `undefined`. The interface deliberately makes that value unusable so code can't work on one platform and fail on the other. See [`db-driver.web.ts`](db-driver.web.ts.md).

The cost is an extra round trip on every save. It buys backend-independence. **`SELECT id`, not `SELECT *`** — the same discipline as `listNoteSummaries`: fetch only what you use. Existence needs one indexed column, not the whole song.

**The race:** between this check and the UPDATE, another writer could delete the row, and the UPDATE would silently affect nothing while returning `true`. There's no transaction. For a single-user local app with one window, this can't happen in practice — but it's the kind of thing worth naming rather than assuming is handled.

### The UPDATE

The `SET` list mirrors `createNote`'s columns with three deliberate absences:

- **`id`** — the identity, in the `WHERE` instead.
- **`slug`** — *not regenerated on edit*. Rename a song and the URL keeps the old slug. Deliberate: slugs are shared/bookmarked, and `getNote` resolves by ID anyway. The visible consequence is a stale-looking URL after a retitle.
- **`created_at`** — immutable by definition.
- **`is_favorite`** — untouched, because it isn't in `NoteInput`. Editing a song can't un-star it.

**`updated_at=$14` gets `new Date().toISOString()` inline**, computed fresh at the call. Unlike `createNote`, there's no shared `now` const because it's used exactly once.

**Note the parameter ordering quirk:** `tuning` is `$13` in the SET clause but appears *after* `bpm` in the values array — the SQL text lists `bpm=$12, tuning=$13` and the array is `[..., bpm, tuning, ...]`. Consistent, but the SET clause's column order differs from `createNote`'s INSERT order (`tuning` sits much earlier there). Positional binding across a 15-element array is exactly where an off-by-one hides; if you ever edit these, count carefully.

**`return true`** — reached only when a row existed.

---

## `upsertNote(note)`

```ts
export async function upsertNote(note: Note): Promise<void>
```

> *"Inserts a note as-is (preserving its id/slug/createdAt/isFavorite), or overwrites the existing row with the same id. Used by library import, where notes arrive with identity already assigned by the exporting device."*

**Takes a full `Note`, not a `NoteInput`** — and that's the whole distinction. Import must *preserve* foreign identity: the ID from the exporting device (so setlist memberships in the same file still resolve), the original creation date, the favourite flag. Everything `NoteInput` deliberately withholds from a form, this function requires.

### `ON CONFLICT(id) DO UPDATE SET ... excluded.*`

SQLite's UPSERT. If the INSERT would violate the primary key, run the UPDATE instead.

**`excluded`** is a pseudo-table naming the row that *would have been* inserted. So `title=excluded.title` means "take the incoming value." Every column is listed, including `slug` and `created_at` — **unlike `updateNote`, this is a full overwrite**. Correct for import: re-importing a library should restore it exactly, not merge.

**`ON CONFLICT(id)` names the id column specifically**, not a bare `ON CONFLICT`. That matters because `slug` is also `UNIQUE`: a slug collision between two different notes will *not* be caught by this clause and will throw. An edge case (slugs carry a random suffix) but a real one.

**`note.updatedAt ?? note.createdAt`** — the same fallback `rowToSummary` applies on read, repeated here because an imported note from an older export may lack the field.

**`note.isFavorite ? 1 : 0`** — the boolean⇄integer conversion. SQLite has no boolean type. The ternary also normalises `undefined` to `0`.

**`Promise<void>`** — no return value, unlike `updateNote`'s boolean. Upsert can't fail to match by definition, so there's nothing to report.

---

## `toggleFavorite(id, value)`

```ts
await db.execute("UPDATE notes SET is_favorite = $1 WHERE id = $2", [value ? 1 : 0, id]);
```

The smallest write, and it's a **single-column update by design**. Starring from a feed card must not touch anything else — no `updated_at` bump (favouriting isn't editing, and bumping it would scramble "recently edited"), no read-modify-write of the whole note.

**Takes an explicit `value` rather than flipping** (`SET is_favorite = NOT is_favorite`). The caller already knows the desired state from the UI, and passing it makes the operation idempotent — clicking twice fast can't land in the wrong state.

No existence check, no return value: toggling a deleted note is a harmless no-op.

---

## `deleteNote(id)`

```ts
await db.execute("DELETE FROM setlist_items WHERE note_id = $1", [id]);
await db.execute("DELETE FROM notes WHERE id = $1", [id]);
```

> *"`setlist_items` declares `ON DELETE CASCADE`, but that only fires when `PRAGMA foreign_keys` is on for the connection running the delete — and the Tauri plugin pools connections, so it may not be. Removing the memberships explicitly is what actually keeps setlist counts honest."*

**This is the fix for the bug described in `db-driver.ts`'s orphan-purge comment.** The chain: pooled connections ⇒ pragma unreliable ⇒ cascade doesn't fire ⇒ orphaned `setlist_items` ⇒ `listSetlists`' `COUNT(*)` reads "8 songs" over 7 visible rows.

**Order matters:** children first, then the parent. Deleting the note first would leave a window where the orphans exist; on a database where the pragma *is* on, deleting the parent first would work via cascade, and the child delete would be a no-op. Children-first is correct in both cases.

**No transaction.** If the process died between the two statements you'd have a note whose memberships are gone — a much more benign failure than the reverse, which is presumably why this order was chosen. The `SqlDriver` interface exposes no transaction primitive at all, so it isn't available even if wanted.

`idx_setlist_items_note` exists precisely to make the first statement an index seek rather than a scan.

---

# ── Helpers ──

## `SummaryRow` and `Row`

```ts
interface SummaryRow { /* ...snake_case, SQL-shaped... */ }
export interface Row extends SummaryRow {
  chord_sheet: string | null;
  tab_blocks: string | null;
}
```

**The raw database shape**, mirroring `SUMMARY_COLUMNS` / `SELECT *`. Three systematic differences from the domain types in `types.ts`:

| | `Row` (SQL) | `Note` (domain) |
|---|---|---|
| Naming | `created_at` | `createdAt` |
| Absence | `string \| null` | `string \| undefined` |
| JSON arrays | `tags: string` | `tags: string[]` |
| Booleans | `is_favorite: number` | `isFavorite: boolean` |

`Row extends SummaryRow` mirrors `Note` ⊃ `NoteSummary` on the SQL side — same relationship, expressed by extension here and by `Omit` there.

**`Row` is exported, `SummaryRow` is not.** [`backup.ts`](backup.ts.md) needs `Row` (and `rowToNote`) to convert raw rows during import; nothing outside needs the summary shape.

**Note `tuning: string | null`** even though the column is `NOT NULL DEFAULT 'standard'`. Defensive: the column was added by migration, and being honest about the possibility costs one `??` in the mapper.

---

## `parseJsonColumn<T>(raw, fallback)`

```ts
function parseJsonColumn<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
```

> *"`JSON.parse` that degrades to a fallback instead of taking the page down."*

**Why this exists:** four columns store JSON. `JSON.parse` throws on malformed input, and an uncaught throw inside `rows.map(rowToSummary)` would take down the **entire feed** — one corrupt row would make the whole library unreachable. This confines the damage to one field of one note.

**`if (!raw)`** catches both `null` (a nullable column with no value) and `""` (which would throw). One check, two cases — the same idiom as `settings.ts`.

**`catch { return fallback }`** — a bare catch, no binding. Nothing actionable to do with the error.

**The generic + fallback pairing is what makes it flexible:** the caller decides what "missing" means for that field.

```ts
parseJsonColumn<string[]>(r.tags, [])                        // → always an array
parseJsonColumn<string[] | undefined>(r.strumming_pattern, undefined)  // → array or absent
```

`tags` and `chords` get `[]` because their columns are `NOT NULL` and consumers iterate them unconditionally. `strumming_pattern` and `tab_blocks` get `undefined` because their absence is meaningful — `{#if note.strummingPattern}` should be false, not "an empty pattern."

**The unchecked cast** (`as T`) is the same trust boundary as `select<T>`: valid JSON of the wrong *shape* passes through silently. Acceptable because the writer is `JSON.stringify` in this same file.

---

## `rowToSummary(r)` and `rowToNote(r)`

```ts
function rowToSummary(r: SummaryRow): NoteSummary { /* field-by-field */ }

export function rowToNote(r: Row): Note {
  return {
    ...rowToSummary(r),
    chordSheet: r.chord_sheet ?? undefined,
    tabBlocks: parseJsonColumn<TabBlock[] | undefined>(r.tab_blocks, undefined),
  };
}
```

**The anti-corruption layer.** Every difference between SQL and domain shapes is resolved here, in one place:

- **Renaming:** `created_at` → `createdAt`, etc. Written out longhand — no clever automatic snake→camel conversion, because an explicit mapping is greppable and can't surprise you.
- **`updatedAt: r.updated_at ?? r.created_at`** — the migration fallback described in `types.ts`. Old rows predate the column.
- **`tuning: r.tuning ?? "standard"`** — same, for the tuning migration.
- **`bpm: r.bpm ?? undefined`** — `null` → `undefined`, so the optional field behaves optionally. Note this uses `??`, so **`bpm: 0` survives** rather than being coerced away.
- **`isFavorite: r.is_favorite === 1`** — integer → boolean. Strict `=== 1`, so any unexpected value reads as `false`.
- **Casts:** `r.type as NoteType`, `r.difficulty as Difficulty`. Unvalidated — a database row with `type: "banana"` would flow through typed as `NoteType` and break rendering downstream. The columns have no `CHECK` constraint, so nothing enforces this at either layer. A real (if unlikely) soft spot.

**`rowToNote` composes rather than duplicates:** it spreads `rowToSummary(r)` and adds the two body fields. So the sixteen shared conversions are written once. If a field's mapping changes, one edit covers both paths. This is the cleanest structural decision in the file.

**`rowToNote` is exported** (for `backup.ts`); `rowToSummary` is not.

---

## `makeSlug(title, artist)`

```ts
function makeSlug(title: string, artist: string): string {
  const base = `${title}-${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
```

A four-step pipeline:

1. **`` `${title}-${artist}` ``** — combine, so "Wonderwall" by Oasis and by anyone else differ.
2. **`.toLowerCase()`** — URL convention.
3. **`.replace(/[^a-z0-9]+/g, "-")`** — everything that isn't a lowercase letter or digit becomes a hyphen. The **`+`** is the important part: it's greedy, so a run of characters collapses to *one* hyphen. `"Hey, Jude!"` → `"hey-jude-"`, not `"hey--jude--"`.
   Note this runs *after* `toLowerCase()`, so the character class needs no `A-Z`. Reordering these two lines would silently mangle every capital letter into a hyphen.
   **Non-ASCII is destroyed:** `"Café"` → `"caf-"`. No Unicode normalisation. A real limitation for non-English titles.
4. **`.replace(/^-|-$/g, "")`** — trim a leading or trailing hyphen. The alternation `^-|-$` with `/g` handles both ends in one pass. Needed because step 3 leaves a trailing hyphen for any title ending in punctuation.

### The random suffix

```ts
`${base}-${Math.random().toString(36).slice(2, 7)}`
```

`Math.random()` → `0.k3j4h5...`; `.toString(36)` renders it in base 36 (`0-9a-z`) → `"0.k3j4h5g6"`; `.slice(2, 7)` drops the `"0."` and takes 5 characters.

**Why a random suffix at all:** `slug` is `UNIQUE NOT NULL`. Two notes titled "Untitled" with no artist would produce identical slugs and the second INSERT would throw. ~60 million combinations (36⁵) makes a collision negligible at personal-library scale.

**Why not a uniqueness check:** it would need a query and a retry loop. Random is one line and good enough — a deliberate simplicity trade.

**`Math.random()` is not cryptographic**, which is fine: this is a display/URL identifier, not a secret. The actual identity is the `crypto.randomUUID()` in `createNote`.

**Called only from `createNote`.** `updateNote` doesn't regenerate it, so slugs are stable across renames — see above.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `if (byId.length)` / `if (bySlug.length)` | `getNote` | Two indexed lookups instead of an un-indexable `OR` |
| `if (!existing.length) return false` | `updateNote` | Existence check, because `execute`'s return is backend-specific |
| `?.length ? stringify : null` | 4 sites | Normalise empty-and-absent to a single `NULL` |
| `?? null` / `?? undefined` | many | `undefined`⇄`null` at the SQL boundary; `??` not `\|\|` so `0` and `""` survive |
| `value ? 1 : 0` | `toggleFavorite`, `upsertNote` | boolean → INTEGER |
| `if (!raw)` + `try/catch` | `parseJsonColumn` | One bad row must not take down the feed |
| `.map(rowToSummary)` / `.map(rowToNote)` | list queries | The only loops in the file |
| regex `+` and `^-\|-$` | `makeSlug` | Collapse runs, trim ends |

**No explicit `for`/`while` anywhere** — all iteration is `Array.prototype.map`, over rows.

---

## Cross-cutting observations

**Every function is `async` and starts with `await getDb()`.** No connection is threaded through, no transaction ever opened. That's the whole model, and it works because `getDb` memoises.

**No transactions at all.** `deleteNote` does two statements; `updateNote` does a read then a write. Both are non-atomic. For a single-user local app this is a considered simplification, not an oversight — but it's the first thing that would need to change for multi-window or sync.

**Reads and writes never overlap in scope.** No function both queries and mutates except `updateNote`'s existence check. Keeps each function's blast radius small.

---

## Related

- [`lib/db-driver.ts`](db-driver.ts.md) — schema, indexes, `getDb`
- [`lib/db-driver.web.ts`](db-driver.web.ts.md) — why `execute`'s return value is unusable
- [`lib/types.ts`](types.ts.md) — the domain shapes these map to
- [`lib/setlists.ts`](setlists.ts.md) — the sibling data layer; the `noteCount` bug `deleteNote` fixes
- [`lib/backup.ts`](backup.ts.md) — the only consumer of `upsertNote`, `Row`, and `rowToNote`
- [`components/feed/FeedClient.svelte`](../components/feed/FeedClient.svelte.md) — why `listNoteSummaries` was optimised
