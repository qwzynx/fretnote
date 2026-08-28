# `src/lib/backup.ts`

**Role:** The `.fretnote` file format — export and import of the whole library, or a single note.
**Size:** 324 lines. **Depends on:** `./db`, `./db-driver`, `./setlists`, `./export` (for `sanitizeFilename`), `./types`.

**The only place in the codebase that validates foreign data properly.** Everywhere else (localStorage, SQLite JSON columns) the writer is trusted; here the input is a file that may have come from another device, an older version, or a text editor.

---

## The file format

```ts
const BACKUP_VERSION = 1;

interface LibraryBackup {
  version: number;
  kind?: "library";
  exportedAt: string;
  notes: Note[];
  setlists: Setlist[];
  setlistItems: SetlistItemInput[];
}

interface NoteBackup {
  version: number;
  kind: "note";
  exportedAt: string;
  note: Note;
}
```

**Two file kinds sharing one extension.** `kind` is the discriminant — the same tagged-union idea as `ParsedLine` in [`parse.ts`](music/parse.ts.md), but crossing a persistence boundary where the tag has to survive `JSON.stringify`.

> *"Older library files (from before per-note export existed) don't carry this field — `isLibraryBackup()` falls back to shape-sniffing for those."*

**`kind?` is optional on `LibraryBackup` and required on `NoteBackup`.** That asymmetry is backwards compatibility: library export shipped first, without a tag. When single-note export was added, both got tagged — but existing library files in the wild have no `kind`, so the library check must accept its absence while the note check can require it.

**`version: number`** — present, written, and **never read**. There's no `if (data.version > BACKUP_VERSION) throw`. Forward-compatibility is unhandled: a future v2 file would be parsed as v1 and whatever `normalizeNote` makes of it. Cheap to add, currently absent.

**`exportedAt`** — written, never read. Human-readable provenance when you open the file in an editor.

**`SetlistItemInput` is imported from [`setlists.ts`](setlists.ts.md)**, which makes that interface part of the on-disk format. Renaming a field there silently breaks every existing `.fretnote` file.

---

## `isLibraryBackup(value)`

```ts
function isLibraryBackup(value: unknown): value is LibraryBackup {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== undefined && v.kind !== "library") return false;
  return (
    typeof v.version === "number" &&
    Array.isArray(v.notes) &&
    Array.isArray(v.setlists) &&
    Array.isArray(v.setlistItems)
  );
}
```

**A type predicate** (`value is LibraryBackup`) — a narrowing signature, so after `if (isLibraryBackup(data))` TypeScript treats `data` as a `LibraryBackup`. The compiler takes this on trust; the function's job is to earn it.

**`!value || typeof value !== "object"`** — the `!value` half is essential because **`typeof null === "object"`**, JavaScript's oldest wart. Without it, `null` would pass the type check and every property access below would throw.

**`v.kind !== undefined && v.kind !== "library"`** — the backwards-compatibility clause. Read it as: *if a `kind` is present it must say "library"; if absent, keep going.* This is what lets untagged legacy files through while still rejecting a note file.

**The four shape checks** are the "sniffing" fallback for untagged files: a `version` number and three arrays. Enough to distinguish a library from a note file (which has `note`, an object, and no arrays) without being so strict that a slightly-different file is rejected.

**`Array.isArray`, not `typeof === "object"`** — arrays *are* objects, so the specific check is required.

**The contents aren't validated here** — only that they're arrays. Element validation is `normalizeNote`'s job, deliberately separated so the two concerns don't tangle.

---

## `normalizeNote(value, index)`

> *"Coerces one note from a backup file into a shape the DB layer can bind. Files written by older versions predate `tuning` and `updatedAt`, and a hand-edited file can carry a null where an array belongs — previously either produced a raw SQLite error partway through the import."*

**The most defensive function in the codebase**, and the comment says exactly which bug it fixes.

### The two hard requirements

```ts
if (!value || typeof value !== "object") throw new Error(`Note ${index + 1} in this file isn't valid.`);
const n = value as Record<string, unknown>;
if (typeof n.id !== "string" || !n.id) throw new Error(`Note ${index + 1} in this file is missing an id.`);
if (typeof n.title !== "string") throw new Error(`Note ${index + 1} in this file is missing a title.`);
```

**Only `id` and `title` throw.** Everything else gets a default. That split is the design:

- **`id`** is the upsert key. Without it there's no way to know what row to write, and a generated one would silently duplicate the note on every import.
- **`title`** is the only field with no sensible default — `""` would produce an unfindable note.

Everything else has a defensible fallback, so it's coerced rather than rejected.

**`typeof n.id !== "string" || !n.id`** — two checks: right type, and non-empty. `""` is a string but useless as a primary key.

**`Note ${index + 1}`** — 1-based numbering in the message, because the person reading it is looking at a file, not an array. Small detail; it's the difference between an actionable error and a confusing one.

**Throwing rather than skipping** the bad note is deliberate — see `importLibrary`'s validate-everything-first strategy below.

### The two coercion helpers

```ts
const str = (v: unknown, fallback: string) => typeof v === "string" ? v : fallback;
const strArray = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
```

**`str`** — a typed value or a default. Handles `undefined` (old file), `null` (hand-edited), and wrong types (a number where a string belongs) with one expression.

**`strArray`** — the stricter one. Not an array ⇒ `[]`. An array ⇒ **filter out every non-string element**. So `["rock", null, 42, "acoustic"]` becomes `["rock", "acoustic"]` rather than being rejected wholesale.

**`(x): x is string`** — a type predicate on the filter callback, so the result narrows from `unknown[]` to `string[]`. Same technique as `tabSteps`' `(f): f is number` in [`fingering.ts`](music/fingering.ts.md).

**Salvage over rejection** is the guiding principle: a partially-corrupt tag array shouldn't lose the whole song.

### Field-by-field

```ts
const createdAt = str(n.createdAt, new Date().toISOString());
```

Hoisted to a local because it's used twice — as itself and as `updatedAt`'s fallback. Computing `new Date()` twice could produce different values.

```ts
slug: str(n.slug, "") || `${n.id}`,
```

> *"Slug is UNIQUE NOT NULL; a file missing one would abort the insert."*

**Two-stage fallback.** `str(n.slug, "")` normalises a missing/wrong-typed slug to `""`; then `|| \`${n.id}\`` catches both that and a genuinely empty stored slug. **`||` is correct here** — `""` is exactly what's being caught, so `??` would let it through and violate `NOT NULL`.

**Falling back to the id** guarantees uniqueness (the id already is unique), at the cost of an ugly URL. Correct priority: a working import beats a pretty slug.

**`` `${n.id}` ``** — a template literal around something already known to be a string. Redundant; `n.id` alone would do.

```ts
type: n.type === "tab" ? "tab" : "chords",
```

**Whitelist, not validation.** Anything that isn't exactly `"tab"` becomes `"chords"`. Handles `undefined`, `null`, `"TAB"`, `"banana"` — all default to the more common type. Note this is the one place in the codebase where `NoteType` is actually enforced at runtime; [`db.ts`](db.ts.md)'s `rowToNote` just casts.

```ts
capo: typeof n.capo === "number" && Number.isFinite(n.capo) ? n.capo : 0,
```

**Both a type check and `Number.isFinite`.** `typeof NaN === "number"` and `typeof Infinity === "number"`, so the type check alone would let either through — and `NaN` in an INTEGER column then propagates into every capo calculation. `Number.isFinite` (not the global `isFinite`, which coerces) rejects both.

**No range check** — a capo of `-5` or `900` passes. The fret arithmetic would produce nonsense but not crash.

```ts
difficulty: n.difficulty === "intermediate" || n.difficulty === "advanced" ? n.difficulty : "beginner",
```

Whitelist again, defaulting to `"beginner"` — matching the column's `DEFAULT 'beginner'`. Note the check is written as two equality tests rather than an array `includes`, which keeps TypeScript's narrowing working so the result types as `Difficulty` without a cast.

```ts
updatedAt: str(n.updatedAt, createdAt),
tuning: str(n.tuning, "standard"),
```

**The two migration fields**, defaulting exactly as [`db-driver.ts`](db-driver.ts.md)'s `ALTER TABLE` statements do. A file exported before those columns existed imports cleanly.

```ts
chordSheet: typeof n.chordSheet === "string" ? n.chordSheet : undefined,
tabBlocks: Array.isArray(n.tabBlocks) ? (n.tabBlocks as Note["tabBlocks"]) : undefined,
```

**`undefined`, not a default** — these are genuinely optional, and `upsertNote` maps `undefined` to SQL `NULL`.

**`n.tabBlocks as Note["tabBlocks"]` is the validation gap in this function.** Only *array-ness* is checked; the elements are cast unvalidated. A file with `tabBlocks: [{"garbage": true}]` imports successfully and produces a note whose tab renderer will read `undefined` columns. Everything else here is carefully coerced; this one field trusts.

Justifiable — validating nested `TabColumn` tuples would be a lot of code — but worth knowing as the soft spot.

```ts
strummingPattern: Array.isArray(n.strummingPattern) ? strArray(n.strummingPattern) : undefined,
```

**Note the asymmetry with `tabBlocks`:** this one *is* element-validated via `strArray`, because its elements are flat strings. The double check (`Array.isArray` then `strArray`, which checks again) preserves the `undefined`-vs-`[]` distinction — `strArray` alone would turn a missing pattern into `[]`, which `upsertNote` would then store as `NULL` anyway, but the type would be wrong.

```ts
bpm: typeof n.bpm === "number" && Number.isFinite(n.bpm) && n.bpm > 0 ? n.bpm : undefined,
```

**Three conditions**, one more than `capo`: `bpm > 0`. A zero or negative BPM is meaningless and would break the metronome, so it's normalised away rather than stored.

```ts
isFavorite: !!n.isFavorite,
```

**Double negation** coerces anything to a boolean. The loosest coercion in the function, and appropriately so — a favourite flag has no failure mode worth reporting.

---

## `isNoteBackup(value)`

```ts
return v.kind === "note" && typeof v.version === "number" && !!v.note && typeof v.note === "object";
```

**`kind === "note"` is required**, unlike the library check's optional tag — single-note export never shipped untagged, so there are no legacy files to accommodate.

**`!!v.note && typeof v.note === "object"`** — the `null` guard again.

The `note` object's *contents* aren't checked; `normalizeNote` handles that.

---

## Platform plumbing

### `backupFilename()`

```ts
return `fretnote-backup-${new Date().toISOString().slice(0, 10)}.fretnote`;
```

**`.slice(0, 10)`** takes `YYYY-MM-DD` off the front of an ISO timestamp. Gives `fretnote-backup-2026-08-27.fretnote` — sorts chronologically in a file listing, which is the point of ISO dates.

**Same-day backups collide** by name; the OS save dialog handles that.

### `pickFileBrowser()`

```ts
return new Promise((resolve) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".fretnote,.json";
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);

  const cleanup = () => document.body.removeChild(input);
  input.addEventListener("cancel", () => { cleanup(); resolve(null); });
  input.addEventListener("change", () => { cleanup(); resolve(input.files?.[0] ?? null); });
  input.click();
});
```

**Promisifying a DOM event API.** The same hidden-element technique as `copyTextToClipboard`'s tier 3 in [`export.ts`](export.ts.md) — `position: fixed` + `opacity: 0` rather than `display: none`, because a hidden input can't be clicked programmatically in some browsers.

> *"The `cancel` event only fires on Chromium 113+; on other browsers dismissing the picker without choosing a file just leaves this pending."*

**An honestly documented leak.** On Firefox or older Safari, cancelling the picker resolves nothing — the promise stays pending forever, the hidden input stays in the DOM, and the caller's `await` never returns. The UI is left waiting with no error.

There's no clean fix: the file-input API has no reliable cancel signal. A `window.focus` listener with a timeout is the usual hack, and it's flaky. The comment is the right response — document the limitation rather than ship a fragile workaround.

**`cleanup()` in both handlers**, so the input is removed either way (on the paths that fire).

**`input.files?.[0] ?? null`** — optional chaining plus nullish coalescing. `files` can be `null`, and an empty `FileList` yields `undefined` at index 0.

### `saveTextFileBrowser(filename, text)`

```ts
const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
const a = document.createElement("a");
a.href = url; a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

**The standard browser download trick**: a blob URL and a synthetic click on an `<a download>`.

**`revokeObjectURL` immediately after `click()`** — releases the blob's memory. Safe because `click()` on an anchor is synchronous and the browser has already captured the URL by the time it returns. Skipping this leaks the blob for the page's lifetime.

**The anchor is never appended to the DOM** — unnecessary for a programmatic click, unlike the textarea/input cases above. Nothing to clean up.

**This is the machinery [`export.ts`](export.ts.md) notes doesn't work in Tauri's WebKitGTK webview** — which is why every function below branches to native dialogs.

### `readTransferFile(dialogName)`

```ts
if (!("__TAURI_INTERNALS__" in window)) {
  const file = await pickFileBrowser();
  if (!file) return null;
  return { path: file.name, json: await file.text() };
}

const { open } = await import("@tauri-apps/plugin-dialog");
const { readTextFile } = await import("@tauri-apps/plugin-fs");
const path = await open({ multiple: false, filters: [{ name: dialogName, extensions: ["fretnote", "json"] }] });
if (!path || Array.isArray(path)) return null;
return { path, json: await readTextFile(path) };
```

**Note the inverted platform check** (`!(... in window)`) compared to everywhere else, putting the browser path first. Cosmetic.

**`if (!path || Array.isArray(path))`** — the array check is a **type-narrowing necessity**, not a real runtime case. Tauri's `open()` is typed `string | string[] | null` because it *can* return multiple paths; `multiple: false` guarantees it won't, but the type doesn't know that. Rejecting the array narrows `path` to `string` for the return.

**Returns `{ path, json }`** — `path` is captured but, as it turns out, never used by either caller. Vestigial.

**`dialogName` parameterises only the dialog's filter label** — `"Fretnote Library"` vs `"Fretnote Note"`. Both accept the same extensions, so it's purely cosmetic; the actual kind is determined by parsing.

### `parseJson(json)`

```ts
try { return JSON.parse(json); }
catch { throw new Error("This file isn't valid JSON."); }
```

**Error translation.** `JSON.parse`'s native message (`Unexpected token < in JSON at position 0`) is meaningless to a user. This replaces it with something a person can act on.

Contrast [`db.ts`](db.ts.md)'s `parseJsonColumn`, which *swallows* the error and returns a fallback. Different data, different policy: a corrupt column is one field of one note and the app should survive it; a corrupt file means the import cannot proceed and the user must be told.

---

## `exportLibrary()`

```ts
const [notes, setlists, setlistItems] = await Promise.all([
  listNotes(), listSetlists(), listAllSetlistItems(),
]);
```

**`Promise.all`** — three independent queries in parallel. Same idiom as `WebSqlDriver.create`.

**`listNotes()`, not `listNoteSummaries()`** — export needs the bodies. This is one of the two callers [`db.ts`](db.ts.md)'s comment names.

```ts
const json = JSON.stringify(backup, null, 2);
```

**`null, 2`** — pretty-printed with 2-space indentation. Roughly doubles the file size in exchange for being readable and diffable in a text editor. For a personal backup format that's the right trade; it also means a user can hand-fix a file, which is exactly the scenario `normalizeNote` defends against.

```ts
if (!("__TAURI_INTERNALS__" in window)) { saveTextFileBrowser(...); return true; }
const path = await save({...});
if (!path) return false; // user cancelled the dialog
await writeTextFile(path, json);
return true;
```

**`Promise<boolean>` where `false` means cancelled.** The browser path returns `true` unconditionally — it can't detect cancellation (the download either starts or the user ignores it). An asymmetry between platforms that the return type papers over.

---

## `importLibrary()`

> *"Reads a library backup file and upserts every note/setlist/item **by id**: anything whose id already exists locally is overwritten with the imported version, anything new is added, and **nothing missing from the file is deleted**. This lets two devices converge without wiping local-only notes."*

**The merge semantics are the important part.** Import is not "restore" — it's an upsert-only merge:

| Situation | Result |
|---|---|
| In file, not local | Added |
| In file, also local | **Overwritten** by the file's version |
| Local only | **Kept** |

So phone → desktop import doesn't destroy desktop-only songs. The cost: there's no way to delete via import, and a locally-edited note is silently clobbered by an older version from a file. Last-write-wins with the file always winning — no conflict detection, no timestamp comparison. `updatedAt` exists and is *not* consulted.

### Kind discrimination

```ts
if (isNoteBackup(data)) {
  throw new Error('This is a single-note file, not a library backup. Use "Import note" instead.');
}
if (!isLibraryBackup(data)) {
  throw new Error("This file isn't a valid Fretnote library backup.");
}
```

**Two errors, and the ordering is a UX decision.** Checking for the *wrong-but-recognised* kind first produces a specific, actionable message naming the right command. Only an unrecognised file gets the generic error. Reversing the checks would collapse both into "not valid," which is technically true and much less useful.

`importNote` has the mirror-image pair.

### Validate-everything-first

```ts
// Validate the whole file before writing a single row. Previously each
// note was bound straight to SQLite, so a bad entry halfway down threw a
// raw driver error with the earlier rows already committed and no way to
// tell what had been applied.
const notes = data.notes.map(normalizeNote);
```

**A `.map` over the whole array before any database call.** Because `normalizeNote` *throws* on a bad note, one `map` either produces a fully-validated array or throws before anything is written.

**The bug it fixes**, per the comment: previously a bad note at position 50 of 100 threw a raw SQLite error with 49 notes already committed — a half-imported library with no way to tell what had landed. Validating up front makes the whole operation all-or-nothing at the *validation* stage.

**`.map(normalizeNote)`** passes the callback directly, so `normalizeNote` receives `(value, index)` — which is exactly its signature, and where the `Note N` in the error messages comes from. A neat fit, but fragile: adding a third parameter to `normalizeNote` would silently receive the array.

### The transaction

```ts
const db = await getDb();
await db.execute("BEGIN");
try {
  for (const note of notes) await upsertNote(note);
  for (const setlist of data.setlists) await upsertSetlist(setlist);
  for (const item of data.setlistItems) await upsertSetlistItem(item);
  await db.execute("COMMIT");
} catch (err) {
  await db.execute("ROLLBACK").catch(() => {});
  throw err;
}
```

**The only explicit transaction in the codebase.** `deleteNote`, `deleteSetlist`, and `moveSetlistItem` all do multi-statement work without one; import gets one because it writes hundreds of rows and a partial import is genuinely bad.

**Raw `BEGIN`/`COMMIT`/`ROLLBACK`** — the `SqlDriver` interface has no transaction primitive, so they're issued as ordinary statements.

**On the Tauri driver this may not do what it looks like.** The plugin pools connections, so `BEGIN` and `COMMIT` can land on *different* connections — exactly the problem [`db-driver.ts`](db-driver.ts.md) documents for `PRAGMA foreign_keys`. The transaction is reliable on the single-connection web driver and best-effort on desktop. The up-front validation is what actually makes import safe; the transaction is a second line of defence.

**Three sequential loops, and the order is required:**

> *"Notes and setlists first, since setlist items reference them by id."*

`setlist_items` has foreign keys to both. Inserting a membership before its note would violate them (where enforcement is on). Parents before children — the mirror of `deleteNote`'s children-before-parents.

**`await` inside each loop** — sequential, not parallel. `Promise.all` over hundreds of upserts would flood the connection pool and, on the web driver, defeat the same-tick flush coalescing in [`db-driver.web.ts`](db-driver.web.ts.md). Sequential is slower per row but predictable.

**`await db.execute("ROLLBACK").catch(() => {})`** — the rollback's own failure is swallowed. Correct: if `ROLLBACK` fails there's nothing further to do, and letting it throw would **replace** the original error with a less informative one. The `throw err` then re-raises the real cause.

**`data.setlists` and `data.setlistItems` are passed straight through unvalidated** — no `normalizeSetlist`. Only notes get the treatment. A setlist with a missing `title` would hit a `NOT NULL` violation inside the transaction and roll back. Inconsistent, though the blast radius is contained by the transaction.

```ts
return { notes: notes.length, setlists: data.setlists.length };
```

Counts for the success toast. Note `setlistItems` isn't reported.

---

## `exportNote(note)`

Structurally identical to `exportLibrary` with a different payload and filename:

```ts
const filename = `${sanitizeFilename(note.title)}.fretnote`;
```

**`sanitizeFilename` imported from [`export.ts`](export.ts.md)** — the one dependency between the two export modules, and it creates a small coupling: `backup.ts` imports from `export.ts` purely for that helper. A shared `filenames.ts` would be tidier.

**`kind: "note"` is set explicitly**, unlike `LibraryBackup`'s optional tag.

---

## `importNote()`

```ts
const note = normalizeNote(data.note, 0);
const existing = await getNote(note.id);
if (existing) {
  const overwrite = confirm(`A note named "${existing.title}" already exists. Overwrite it with the imported version?`);
  if (!overwrite) return null;
}
await upsertNote(note);
return note;
```

**`normalizeNote(data.note, 0)`** — index `0` so the error message reads "Note 1", which is odd phrasing for a single-note file but harmless.

**The confirmation is the meaningful difference from `importLibrary`.** Library import overwrites silently by design (it's a bulk merge); a single note is a deliberate act on one song, so silently destroying a local edit would be surprising. The dialog shows the **existing** note's title, not the incoming one — which is what the user needs to recognise what's about to be lost.

**`confirm()` — the native browser dialog.** The one place the codebase uses it instead of a component. It's **blocking and unstyled**, inconsistent with the app's design system, and in Tauri's webview it renders as a plain system dialog. A `Dialog` component would fit better; `confirm` was presumably chosen for expedience on a rarely-hit path.

**Returns `null` on decline** — the same sentinel as "user cancelled the file picker," so the caller can't distinguish "no file chosen" from "declined to overwrite." Both mean "nothing happened," so it doesn't matter in practice.

**No transaction** — one upsert is already atomic.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `!value \|\| typeof value !== "object"` | both guards, `normalizeNote` | `typeof null === "object"` |
| `v.kind !== undefined && v.kind !== "library"` | `isLibraryBackup` | Accept legacy untagged files, reject note files |
| `Array.isArray` ×4 | `isLibraryBackup` | Arrays are objects — the specific check is required |
| `throw` on `id`/`title` only | `normalizeNote` | Everything else has a defensible default |
| `(x): x is string` filter | `strArray` | Salvage good elements instead of rejecting the array |
| `str(n.slug, "") \|\| n.id` | `normalizeNote` | `\|\|` required — `""` violates `NOT NULL` |
| `n.type === "tab" ? "tab" : "chords"` | `normalizeNote` | Whitelist; the only runtime `NoteType` enforcement |
| `Number.isFinite` | capo, bpm | `typeof NaN === "number"` |
| `n.bpm > 0` | `normalizeNote` | Zero BPM would break the metronome |
| `!!n.isFavorite` | `normalizeNote` | Loosest coercion — no failure mode worth reporting |
| `if (!path \|\| Array.isArray(path))` | `readTransferFile` | Type narrowing for Tauri's `string \| string[] \| null` |
| `catch → throw new Error(...)` | `parseJson` | Translate an unreadable native message |
| specific-kind check **before** generic | both importers | Actionable error naming the right command |
| `.map(normalizeNote)` before `BEGIN` | `importLibrary` | All-or-nothing validation; fixes half-imported libraries |
| `BEGIN` / `COMMIT` / `ROLLBACK` | `importLibrary` | The only explicit transaction; best-effort on desktop |
| notes → setlists → items | `importLibrary` | FK order: parents before children |
| `.catch(() => {})` on `ROLLBACK` | `importLibrary` | Don't mask the original error |
| `if (existing)` + `confirm` | `importNote` | Single-note overwrite is a deliberate, surprising act |

---

## Known gaps

1. **`version` is written but never checked** — a future v2 file imports as v1.
2. **`tabBlocks` elements are cast, not validated** — the one hole in `normalizeNote`.
3. **Setlists and items aren't normalised at all** — only notes get the treatment.
4. **`pickFileBrowser` leaks a pending promise** on non-Chromium cancel (documented in-source).
5. **`readTransferFile`'s `path` is returned and never used.**
6. **The transaction is unreliable on the pooled Tauri driver.**
7. **Import always wins over local edits** — `updatedAt` is never compared.

---

## Related

- [`lib/db.ts`](db.ts.md) — `upsertNote`, `listNotes`, `getNote`
- [`lib/setlists.ts`](setlists.ts.md) — the three functions that exist only for this file; `SetlistItemInput` is part of the file format
- [`lib/db-driver.ts`](db-driver.ts.md) — why the transaction is best-effort on desktop
- [`lib/export.ts`](export.ts.md) — `sanitizeFilename`, and the same platform-branching pattern
- [`pages/SettingsPage.svelte`](../pages/SettingsPage.svelte.md) — the import/export UI
