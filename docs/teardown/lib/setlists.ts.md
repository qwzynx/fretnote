# `src/lib/setlists.ts`

**Role:** Every SQL query for the `setlists` and `setlist_items` tables. The sibling of [`db.ts`](db.ts.md).
**Size:** 179 lines. **Depends on:** `./db-driver` (`getDb`), `./db` (`rowToNote`, `Row`), `./types`.

Same conventions as `db.ts`: every function is `async`, opens with `await getDb()`, uses `$N` placeholders, and maps snake_case rows to camelCase objects by hand.

---

## `SetlistRow`

```ts
interface SetlistRow {
  id: string; title: string; description: string;
  created_at: string; note_count: number;
}
```

**`note_count` is not a column** — it's a `COUNT(*)` from the query below. Folding it into the row interface (rather than a separate type) keeps the mapping in one place, but it means `getSetlistWithNotes` has to fake it with `SELECT *, 0 AS note_count`. See there.

---

## `listSetlists()`

```sql
SELECT s.*, COUNT(i.id) AS note_count
FROM setlists s
LEFT JOIN setlist_items i ON i.setlist_id = s.id
GROUP BY s.id
ORDER BY s.created_at DESC
```

**`LEFT JOIN`, not `JOIN`** — and this is the important detail. An inner join would drop any setlist with zero items, so a newly-created empty setlist would be invisible on the setlists page. `LEFT JOIN` keeps the setlist row and produces `NULL` for the item columns.

**`COUNT(i.id)`, not `COUNT(*)`** — the companion to that choice. `COUNT(*)` counts *rows*, and a `LEFT JOIN` with no matches still produces one row, so an empty setlist would report `1`. `COUNT(column)` skips `NULL`s, giving the correct `0`. Getting this pair wrong is one of the classic SQL mistakes, and both halves are right here.

**`GROUP BY s.id`** with `s.*` in the select list is technically non-standard SQL — but legal in SQLite, which permits selecting columns functionally dependent on the grouped primary key.

**This is the query the orphan-purge in [`db-driver.ts`](db-driver.ts.md) exists to protect.** Before that fix, `setlist_items` rows pointing at deleted notes were still counted here, while [`getSetlistWithNotes`](#getsetlistwithnotes) below uses an *inner* `JOIN` that drops them — so a card read "8 songs" above a list of 7.

**`ORDER BY created_at DESC`** — newest first, matching the feed's convention. Note there is **no index** on `setlists.created_at` (unlike `notes`), so this sorts. Fine: setlists number in the tens.

---

## `createSetlist(title, description = "")`

Mirrors `createNote`: `crypto.randomUUID()` for the id, `new Date().toISOString()` for the timestamp, and the object is **constructed in memory** rather than re-read.

**`description = ""` default parameter** matches the column's `NOT NULL DEFAULT ''`, so a setlist created without a description has an empty string rather than null — consistent with `Setlist.description` being required in [`types.ts`](types.ts.md).

**`noteCount: 0`** in the returned object — correct by construction for a brand-new setlist, and it saves the caller a refetch to render the card.

**No slug.** Unlike notes, setlists are addressed only by UUID (`/setlists/:id`). Nothing shares a setlist URL, so the human-readable identifier isn't worth the complexity.

---

## `upsertSetlist` / `upsertSetlistItem`

Both follow `upsertNote`'s pattern exactly: full `INSERT … ON CONFLICT(id) DO UPDATE SET col=excluded.col` for every column.

**Why they exist:** import. [`backup.ts`](backup.ts.md) reconstructs a library from a file where every row already has an identity assigned by the exporting device, so the operation is "put this row here, replacing whatever's there" — not "create a new one."

`upsertSetlistItem` overwrites `setlist_id`, `note_id`, and `position` — so re-importing a file after reordering a setlist correctly restores the file's order.

---

## `listAllSetlistItems()`

```sql
SELECT id, setlist_id, note_id, position FROM setlist_items
```

**Every membership row in the database, unfiltered.** Only used by export — it's the join table dumped wholesale so `importLibrary` can restore the graph.

`SetlistItemInput` is the camelCase form. Note it's exported and reused as the item type in `backup.ts`'s `LibraryBackup`, so this interface is effectively part of the **file format**. Renaming a field here would break every existing `.fretnote` file.

---

## `updateSetlist(id, title, description)`

```ts
await db.execute("UPDATE setlists SET title=$1, description=$2 WHERE id=$3", [...]);
```

**Only the two editable fields.** `created_at` is immutable, `id` is identity. No existence check and no return value — unlike `updateNote`, which returns a boolean. Slight inconsistency; editing a deleted setlist is a silent no-op here.

**No `updated_at`** — the setlists table doesn't have one. Setlists aren't sorted by edit time, so the column was never needed.

---

## `deleteSetlist(id)`

```ts
// Explicit rather than relying on ON DELETE CASCADE — see deleteNote.
await db.execute("DELETE FROM setlist_items WHERE setlist_id=$1", [id]);
await db.execute("DELETE FROM setlists WHERE id=$1", [id]);
```

**Children before parent**, same as `deleteNote`. The comment points at the full explanation: the Tauri SQL plugin pools connections, so `PRAGMA foreign_keys = ON` may not hold on whichever connection runs the delete, making the declared cascade unreliable. See [`db-driver.ts`](db-driver.ts.md) phase 2.

`idx_setlist_items_setlist` makes the first statement an index seek.

**No transaction** — if the process died between the statements you'd have an empty setlist rather than orphaned items, which is the benign direction. Same reasoning as `deleteNote`.

---

## `getSetlistWithNotes(id)`

Two queries, deliberately not one.

### Query 1 — the setlist itself

```ts
"SELECT *, 0 AS note_count FROM setlists WHERE id=$1"
```

**`0 AS note_count` is a type-system workaround, not real data.** `SetlistRow` declares `note_count: number`, so a `SELECT *` alone wouldn't satisfy the declared row shape. Rather than define a second interface, the query synthesises a constant.

The value is then thrown away — the returned object uses `noteCount: noteRows.length` instead. It's a small wart: a literal in SQL papering over an interface that models two different queries. A `SetlistRow` without `note_count` plus a separate `SetlistCountRow` would be cleaner.

```ts
if (!setlistRows.length) return null;
```

Not-found returns `null`, same convention as `getNote`.

### Query 2 — the notes, in order

```sql
SELECT n.*, i.id AS item_id, i.position
FROM setlist_items i
JOIN notes n ON n.id = i.note_id
WHERE i.setlist_id = $1
ORDER BY i.position ASC
```

**An inner `JOIN` here, versus the `LEFT JOIN` in `listSetlists`.** Correct in both cases and for opposite reasons: `listSetlists` wants empty setlists to appear, while this wants to render actual notes — a membership row pointing at a deleted note has nothing to draw. The inner join silently drops orphans, which is exactly the asymmetry that produced the "8 songs / 7 rows" bug.

**`SELECT n.*` — full notes, not summaries.** The setlist page shows enough of each song to be useful during a gig, so bodies are needed. Contrast `listNoteSummaries`.

**`i.id AS item_id`** — the alias is essential. Both tables have an `id` column, and without renaming, `n.*` and `i.id` would collide (SQLite would return one of them, unpredictably). The item id is needed because removal and reordering operate on the *membership*, not the note — a note can be in several setlists.

**`ORDER BY i.position ASC`** — served entirely by the composite index `idx_setlist_items_setlist(setlist_id, position)`. The index's column order means the `WHERE` and the `ORDER BY` are both satisfied by one index walk, with no sort step.

### The `_itemId` smuggle

```ts
notes: noteRows.map((r) => ({ ...rowToNote(r), _itemId: r.item_id } as Note & { _itemId: string })),
```

**This is the one hack in the file.** `SetlistWithNotes.notes` is typed `Note[]`, but the UI needs the membership id to remove or reorder a row. Rather than change the type to a `SetlistNote` with both, the item id is attached as an extra property and the whole thing cast.

**The `_` prefix** signals "not a real `Note` field." **The intersection cast** (`as Note & { _itemId: string }`) makes it compile without widening the declared return type.

The cost: `SetlistWithNotes.notes` is typed `Note[]`, so consumers reading `note._itemId` get a **type error** and must cast again at the use site. The type lies in one direction and is too narrow in the other. A `SetlistEntry { note: Note; itemId: string; position: number }` would be the honest model.

Worth flagging as a place where following the types will mislead you — grep for `_itemId` to find what actually depends on it.

---

## `addNoteToSetlist(setlistId, noteId)`

Three queries: check, find position, insert.

```ts
const existing = await db.select(
  "SELECT id FROM setlist_items WHERE setlist_id=$1 AND note_id=$2", [setlistId, noteId]);
if (existing.length) return;
```

**Idempotence via a duplicate check.** Adding a song already in the setlist is a silent no-op — right for the UI, where the same "Add to setlist" dialog may be opened twice.

**Enforced in application code, not the schema.** There's no `UNIQUE(setlist_id, note_id)` constraint, so two concurrent calls could both pass the check and insert. Single-user local app; not reachable in practice.

```ts
const maxRows = await db.select<{ max_pos: number | null }[]>(
  "SELECT MAX(position) AS max_pos FROM setlist_items WHERE setlist_id=$1", [setlistId]);
const pos = (maxRows[0]?.max_pos ?? -1) + 1;
```

**Append to the end.** `MAX(position) + 1`.

**`(maxRows[0]?.max_pos ?? -1) + 1`** — two guards in one expression:
- `maxRows[0]?.` — optional chaining, in case the driver returns no row at all.
- `?? -1` — `MAX()` over an empty set returns `NULL`, which maps to `null`. `-1 + 1 = 0`, so the first item lands at position 0.

**`??` not `||`** is required here: `max_pos` of `0` (a setlist with exactly one item at position 0) is falsy, and `||` would reset the next item to position 0 as well, producing a duplicate.

**Positions are dense and zero-based** by construction — `0, 1, 2, …` — but nothing enforces it. `moveSetlistItem` swaps values rather than renumbering, so gaps could appear if items were deleted. In practice `removeFromSetlist` leaves gaps, and `ORDER BY position` still works correctly with gaps. Sparse positions are harmless.

---

## `removeFromSetlist(itemId)`

```ts
await db.execute("DELETE FROM setlist_items WHERE id=$1", [itemId]);
```

**Takes the item id, not a `(setlistId, noteId)` pair** — which is the whole reason `_itemId` is smuggled through `getSetlistWithNotes`. One statement, no reindexing of the remaining positions.

---

## `moveSetlistItem(setlistId, itemId, direction)`

```ts
const items = await db.select("SELECT id, position FROM setlist_items WHERE setlist_id=$1 ORDER BY position ASC", [setlistId]);
const idx = items.findIndex((i) => i.id === itemId);
if (idx === -1) return;
const swapIdx = direction === "up" ? idx - 1 : idx + 1;
if (swapIdx < 0 || swapIdx >= items.length) return;

const a = items[idx];
const b = items[swapIdx];
await db.execute("UPDATE setlist_items SET position=$1 WHERE id=$2", [b.position, a.id]);
await db.execute("UPDATE setlist_items SET position=$1 WHERE id=$2", [a.position, b.id]);
```

**Reordering by swapping two adjacent positions.**

**`ORDER BY position ASC` then `findIndex`** — the array index is the *display* position, which may differ from the stored `position` value if there are gaps. Working in array space and then writing back the stored values is what makes the swap correct regardless of gaps.

**`direction === "up" ? idx - 1 : idx + 1`** — "up" means earlier in the list, i.e. a lower index. Matches how the list is drawn.

**`if (swapIdx < 0 || swapIdx >= items.length) return`** — bounds check. Moving the first item up or the last down is a silent no-op rather than an error, which is right: the UI shows the buttons unconditionally and lets them do nothing at the ends.

**`if (idx === -1) return`** — the item isn't in this setlist. Defensive; shouldn't happen.

**Two UPDATEs, no transaction, no temporary value.** Because each row is addressed by its own `id` and the two writes touch different rows, there's no intermediate state where a `UNIQUE` constraint could fire — there is no unique constraint on `position`. If the process died between them, two items would share a position; `ORDER BY position` would then order them arbitrarily, but nothing would break. The classic three-step swap (`a → tmp`, `b → a`, `tmp → b`) isn't needed.

**The read-then-write race** exists in principle, as with `updateNote`.

---

## `getSetlistsForNote(noteId)`

```sql
SELECT i.setlist_id, s.title, i.id AS item_id
FROM setlist_items i
JOIN setlists s ON s.id = i.setlist_id
WHERE i.note_id = $1
```

**The reverse lookup**: which setlists contain this note? Powers `AddToSetlistDialog.svelte`, which shows checkmarks next to setlists the note is already in.

**Uses `idx_setlist_items_note`** — the index whose justification in `db-driver.ts` mentions cascade deletes; it serves this query too.

**Returns `itemId` alongside** so the dialog can *remove* the note by unchecking, without a second lookup. Same reason as `getSetlistWithNotes`.

**No `ORDER BY`** — the dialog sorts or displays as it likes. Arguably should match `listSetlists`' ordering for consistency.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `LEFT JOIN` + `COUNT(i.id)` | `listSetlists` | Keep empty setlists visible *and* count them as 0 |
| inner `JOIN` | `getSetlistWithNotes` | Drop memberships pointing at deleted notes |
| `0 AS note_count` | `getSetlistWithNotes` | Satisfy `SetlistRow`'s declared shape |
| `i.id AS item_id` | two queries | Avoid the `n.id` / `i.id` collision |
| `if (!setlistRows.length) return null` | `getSetlistWithNotes` | Not-found convention |
| `if (existing.length) return` | `addNoteToSetlist` | Idempotent add, enforced in code not schema |
| `(maxRows[0]?.max_pos ?? -1) + 1` | `addNoteToSetlist` | `??` not `\|\|` — position 0 is falsy |
| `if (idx === -1) return` | `moveSetlistItem` | Item not in this setlist |
| `swapIdx < 0 \|\| >= length` | `moveSetlistItem` | Ends of the list are a no-op, not an error |
| children-before-parent deletes | `deleteSetlist` | Cascade is unreliable under connection pooling |
| `.map(...)` ×5 | all list queries | snake_case → camelCase; the only loops in the file |

No explicit `for`/`while` anywhere.

---

## Related

- [`lib/db.ts`](db.ts.md) — the notes half; `rowToNote` and `Row` are imported from it
- [`lib/db-driver.ts`](db-driver.ts.md) — the schema, the indexes, and the orphan-purge that keeps `note_count` honest
- [`lib/backup.ts`](backup.ts.md) — the only caller of the three `upsert*`/`listAll*` functions
- [`lib/types.ts`](types.ts.md) — `Setlist`, `SetlistWithNotes`, and the `noteCount?` field
- [`pages/SetlistPage.svelte`](../pages/SetlistPage.svelte.md) — consumer of `_itemId`
- [`components/ui/AddToSetlistDialog.svelte`](../components/ui/AddToSetlistDialog.svelte.md) — `getSetlistsForNote`
