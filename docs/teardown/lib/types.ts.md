# `src/lib/types.ts`

**Role:** The domain vocabulary. Every noun the app reasons about — `Note`, `TabBlock`, `TabColumn`, `TabHint`, `Setlist` — is defined here. **Read this file before any other.**
**Size:** 103 lines. **Depends on:** nothing. It is the root of the import graph.

---

## Why this file is the spine

`types.ts` imports nothing. Everything else imports it. That makes it the one file where the app's *model of the world* is stated without any implementation noise — no SQL, no Svelte, no rendering. If you understand these seven declarations, every other file becomes a question of "how does this transform a `Note`?"

It also encodes decisions that are invisible elsewhere and expensive to rediscover — chiefly the **string-index ordering conventions** for guitar strings, which are the single biggest source of confusion in this codebase.

---

## `NoteType` and `Difficulty`

```ts
export type NoteType = "chords" | "tab";
export type Difficulty = "beginner" | "intermediate" | "advanced";
```

Two closed string-literal unions.

**Why unions rather than enums:** TypeScript `enum`s emit runtime JavaScript objects and don't round-trip through `JSON.parse` — a string from the database would need mapping back to the enum member. String literal unions *are* strings at runtime, so a value read from SQLite is directly assignable after a cast, and `JSON.stringify` produces exactly the stored form. That's why `db.ts` can write `r.type as NoteType` with nothing more.

**`NoteType` drives the app's central branch.** Almost every rendering path asks "chords or tab?" — `NoteReader`, `NoteCard`, `NotePreview`, `CreateNoteForm`, `export.ts`. Two values, not three, and the fields on `Note` are optional-per-type to match (`chordSheet?` for chords, `tabBlocks?` for tab). This is a **discriminated-union-in-spirit** that isn't actually modelled as one — see the critique under `Note` below.

**`Difficulty` is pure metadata.** Nothing branches on it; it's displayed as a badge and used as a feed filter. Three levels, ordered least→most, and that order matters for the UI's sort/display even though the type system doesn't encode ordering.

---

## `TabColumn` — and the string-ordering convention

```ts
export type TabColumn = [string, string, string, string, string, string];
```

A **fixed-length tuple of exactly six strings**, one per guitar string. One column = one vertical slice of tablature = one moment in time.

**Why a tuple and not `string[]`:** The tuple type makes "six" a compile-time guarantee. `["0","2","2"]` is a type error. Since every consumer indexes `col[0]`..`col[5]` and every renderer draws six lines, a wrong-length column would be a silent rendering bug. The tuple prevents it at the source.

**Why `string` and not `number`:** Because a slot holds three different kinds of thing:

| Value | Meaning |
|---|---|
| `"0"`, `"3"`, `"12"` | Fret number (0 = open string) |
| `"x"` | Muted / not played |
| `""` | Untouched — nothing happens on this string in this column |

`number` can't express `"x"` or `""` without sentinel values like `-1`/`-2`, and those would be far easier to misread. Strings also serialise straight into the `tab_blocks` JSON column with no conversion, and `"12"` renders as-is (a number would need `String()` at every draw site).

### The ordering rule — the most important comment in the file

> *"Strings are ordered low-E (index 0) → high-e, matching `Tuning.names` and `ChordShape.frets`; the display order is reversed when drawn so the high e sits on the top line."*

**Storage order:** index 0 = low E (thickest, 6th string) → index 5 = high e (thinnest, 1st string).
**Display order:** high e on top, low E on bottom — because that's how tablature is conventionally written.

So **every renderer reverses**. That's why the file also exports:

```ts
export const TAB_STRING_LABELS = ["e", "B", "G", "D", "A", "E"] as const;
```

which is `STRING_NAMES` backwards. Two constants for the same six strings, differing only in direction, is not redundancy — it's the storage/display split made explicit so nobody has to remember to call `.reverse()`.

**This is where bugs live.** If a tab renders upside down, or a chord diagram's bass note appears on the wrong line, the cause is almost always an index-order mismatch. When reading `TabView.svelte`, `FingerFretboard.svelte`, or `ChordDiagram.svelte`, the first question to ask is "which order is this loop in?"

The convention is chosen so that **storage order matches physical string order** (6th to 1st, thick to thin) and matches `Tuning.names` and `ChordShape.frets` — one convention across three types, with the flip isolated to the view layer.

---

## `TabHint`

```ts
export interface TabHint {
  frets: [number, number, number, number, number, number];
  shape?: string;
  note?: string;
}
```

> *"The hand shape an author recommends for a tab: hold this and the whole fragment is under your fingers without moving up the neck."*

This is a **domain insight encoded as a type**, and it's the sort of thing you'd never infer from the code alone. A tab tells you which notes to play; it doesn't tell you where to *put your hand*. An experienced player reads a riff and recognises "that's an Em shape at the 5th fret" — a beginner doesn't. `TabHint` lets the author record that recognition.

**`frets` is `number`, not `string`** — unlike `TabColumn`. Different encoding for a different meaning:

| | `TabColumn` | `TabHint.frets` |
|---|---|---|
| Type | `string` | `number` |
| Muted | `"x"` | `-1` |
| Open | `"0"` | `0` |
| Untouched | `""` | *(no representation)* |

A hand shape has no "untouched" state — every string is either fretted, open, or deliberately muted, because the hand is in one position covering all six. So the third state isn't needed, and with only two special cases `-1` works cleanly as a number. This makes the shape directly comparable against `ChordShape.frets` in `lib/music/chords.ts`, which is what enables `chord-detect.ts` to name a grip automatically.

Same low-E-first ordering, restated in the comment — the repetition is deliberate given how easy it is to get wrong.

**`shape?` and `note?` are both optional, and both free text.** `shape` is the chord name when the grip has one (`"Em"`, `"Am (5fr)"`); it's a `string` rather than a chord-name union because barre positions like `"(5fr)"` aren't chord names. `note?` is an escape hatch — *"anything else the author wants to tell the player"* — deliberately unstructured, because the space of useful advice ("thumb over the top", "let the B ring") can't be enumerated.

---

## `TabBlock`

```ts
export interface TabBlock {
  id: string;
  label: string;
  columns: TabColumn[];
  hint?: TabHint;
}
```

> *"A song rarely tabs out end to end — instead it has pieces (an intro riff, a solo, a turnaround) that start and stop wherever they occur."*

This is the key modelling decision for tabs, and it's a good one. The naive design is `Note.tab: TabColumn[]` — one long tab per song. Real songs aren't like that: you tab the intro, the solo, and the turnaround, and the rest is chords. Modelling tabs as a *list of labelled fragments* matches how guitarists actually write, and it's what enables the inline `[tab: Solo]` reference syntax inside a chord sheet.

- **`id`** — a stable identity so the editor can reorder/delete blocks and Svelte's `{#each ... (block.id)}` can key them correctly. Without it, keying by array index makes reordering re-render everything and lose focus.
- **`label`** — the human name (`"Intro"`, `"Solo"`). Doubles as the lookup key for `[tab: Label]` references. **Nothing enforces uniqueness**, so two blocks named "Solo" would make that reference ambiguous — a real edge case worth knowing about.
- **`columns`** — the tab itself, left to right in time.
- **`hint?`** — optional fingering advice.

---

## `Note` — the central entity

```ts
export interface Note {
  id: string;
  slug: string;
  type: NoteType;
  title: string;
  artist: string;
  key: string;
  capo: number;
  difficulty: Difficulty;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  tuning: string;
  chordSheet?: string;
  tabBlocks?: TabBlock[];
  chords: string[];
  strummingPattern?: string[];
  bpm?: number;
  isFavorite?: boolean;
}
```

### Identity: `id` and `slug`

Two identifiers. `id` is a UUID (`crypto.randomUUID()` in `db.ts`) — the primary key, stable forever, never shown. `slug` is a human-readable URL fragment derived from title + artist plus a random suffix.

**Why both:** the UUID is what setlists and imports reference, so it must never change. The slug exists for readable URLs and for `getNote()` to resolve either form — which is why `getNote` does two indexed lookups rather than one `OR` query.

### Dates as ISO strings

```ts
createdAt: string; // ISO date
updatedAt?: string;
```

Not `Date` objects. Deliberate: `Date` doesn't survive `JSON.stringify`/`parse` (it becomes a string anyway, and parsing back is manual), and SQLite has no date type — it stores TEXT. ISO-8601 also **sorts lexicographically in the same order as chronologically**, which is what lets `ORDER BY created_at DESC` work on a TEXT column with no conversion.

**`updatedAt` is optional** — *"Falls back to `createdAt` for older rows."* This is schema-migration debris made visible in the type. The column was added later (see `db-driver.ts`), so old rows have `NULL`. `rowToSummary` applies the fallback (`r.updated_at ?? r.created_at`), so in practice it's always populated by the time you read a `Note` — but the type stays honest about the underlying data.

### `tuning` — and why it's on the note

```ts
tuning: string;
```

> *"Drives the string labels on tabs and the fretboard maths, so it has to travel with the note rather than following the app-wide default."*

This comment is the best one-line statement of the settings-vs-data boundary in the codebase. `lib/settings.ts` has a `defaultTuning`, but that only seeds new notes. A song written in Drop D **is** in Drop D — if it followed a global setting, changing your default would silently misrender every existing tab. Same reasoning applies to `key` and `capo`.

Typed `string`, not a union, because tunings are data in `lib/music/tunings.ts` and the set is open-ended.

### The type-dependent body fields

```ts
chordSheet?: string;
tabBlocks?: TabBlock[];
```

**Both optional, and the type system does not connect them to `type`.** A `Note` with `type: "chords"` and no `chordSheet` compiles fine. So does one with both fields set.

This is the file's main modelling weakness, and worth understanding rather than glossing over. A discriminated union would enforce it:

```ts
type Note = BaseNote & (
  | { type: "chords"; chordSheet: string; tabBlocks?: TabBlock[] }
  | { type: "tab"; tabBlocks: TabBlock[] }
);
```

Why the flat form was chosen anyway: the SQLite row is flat with two nullable columns, so `rowToNote` maps 1:1 with no narrowing; the create form holds both fields simultaneously while the user toggles type (you don't want to lose your lyrics by switching to tab and back); and — critically — **`chords` notes can also carry `tabBlocks`**, referenced inline via `[tab: Label]`. That overlap means the union isn't cleanly disjoint anyway. The cost is that consumers must guard (`{#if note.chordSheet}`) rather than relying on narrowing.

The comment states the convention the types don't: *"For `type === "tab"`, the first block is the main tab."* Positional convention, unenforced.

### `chords` — a denormalised cache

```ts
chords: string[];  // "Chord names referenced by the note, used to render diagrams."
```

For a chord sheet, this is derivable — parse `chordSheet` for `[Am]` markers. It's stored anyway, which is **deliberate denormalisation**:

1. `NoteCard` shows chord chips in the feed. Recomputing means parsing every song's full lyrics on every list render — precisely the cost `listNoteSummaries` was optimised to avoid. `chords` is in `SUMMARY_COLUMNS`; `chord_sheet` is not.
2. Tab notes have no chord sheet to parse, but can still declare which chords they use.
3. The author may want to list a chord the parser wouldn't find.

**The tradeoff:** it can go stale. If `chordSheet` is edited without recomputing `chords`, the diagrams disagree with the lyrics. Keeping them in sync is `CreateNoteForm.svelte`'s job — an invariant maintained by code, not by the schema.

### `strummingPattern?: string[]`

Typed `string[]`, **not** `StrokeType[]`, even though `lib/strumming.ts` defines that union. The looser type is what comes back from `JSON.parse` on the `strumming_pattern` column without validation; narrowing it would be a lie unless something checked. Consumers index `STROKE_DISPLAY` with these values, which works because the data is written by the editor — but an invalid stored value would yield `undefined` at render time.

### `isFavorite?: boolean`

Optional because the column was added by migration. Stored as `INTEGER` (SQLite has no boolean); `rowToSummary` converts with `r.is_favorite === 1`.

---

## `NoteSummary` — the performance type

```ts
export type NoteSummary = Omit<Note, "chordSheet" | "tabBlocks">;
```

> *"What a feed or search result actually draws… Deliberately excludes `chordSheet` and `tabBlocks`, which are the bulk of a row and are never read by a card."*

`Omit<T, K>` constructs a new type with those keys removed. This is **a type expressing a performance decision**, and it's the cleverest thing in the file.

The problem it solves: the feed lists every note. Both excluded fields are unbounded blobs — full lyrics, entire tabs. Loading them to render a card that shows only title/artist/chips meant reading the whole library's text on every keystroke of a filter.

Defining `NoteSummary` as a *derivation* rather than a hand-written interface means adding a field to `Note` automatically adds it to `NoteSummary` — they can't drift. It also makes the omission enforceable: `summary.chordSheet` is a compile error, so a component *cannot* accidentally depend on data the query didn't fetch. The type mirrors `SUMMARY_COLUMNS` in `db.ts`; **keeping those two in sync is manual**, and is the one fragile seam in this design.

---

## `STRING_NAMES`

```ts
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"] as const;
```

The six open strings in **storage order** (low E first). Note the case distinction: `"E"` (6th, low) vs `"e"` (1st, high) — the same trick as `D`/`d` in `strumming.ts`. Case is meaningful; never normalise it.

`as const` makes it a readonly tuple of literals rather than `string[]`, so its order can't be mutated and indexing yields literal types.

---

## `Setlist` and `SetlistWithNotes`

```ts
export interface Setlist {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  noteCount?: number;
}

export interface SetlistWithNotes extends Setlist {
  notes: Note[];
}
```

**`description: string` is required** (defaults to `''` in the schema), unlike most optional metadata. Consistent with the DDL: `description TEXT NOT NULL DEFAULT ''`. Empty string rather than null means no null-checking at render sites.

**`noteCount?: number` is not a column.** It's a `COUNT(*)` computed by the list query — optional because it's only present when that query supplies it. This is the same denormalisation-for-display idea as `Note.chords`: the setlists page needs "8 songs" per card without loading eight notes.

The comment in `db-driver.ts` about orphaned `setlist_items` is precisely about this field lying — a count over rows pointing at deleted notes read "8 songs" above 7 visible rows.

**`SetlistWithNotes extends Setlist`** — the hydrated form for the detail page. The two-type split (`Setlist` for lists, `SetlistWithNotes` for detail) is the same list-vs-detail pattern as `NoteSummary`/`Note`, expressed by extension rather than `Omit`.

Note `notes: Note[]`, not `NoteSummary[]` — the setlist page loads full notes.

---

## `TAB_STRING_LABELS`

```ts
export const TAB_STRING_LABELS = ["e", "B", "G", "D", "A", "E"] as const;
```

**Display order** — the reverse of `STRING_NAMES`. Placed at the very bottom of the file, far from `STRING_NAMES` at the top, which is mildly unfortunate: these two constants are the same fact stated twice in opposite directions, and reading them together is what makes the convention click.

---

## What isn't here

No `Chord`, no `ChordShape`, no `Tuning`. Those live in `lib/music/`, one level down — they're the *theory* layer, not the *storage* layer. `types.ts` is strictly "what gets persisted," which is why it maps so cleanly onto the SQLite schema.

---

## Control flow

None — no functions, no conditionals, no loops. Two `const` arrays and five type declarations. The entire file is compile-time except for `STRING_NAMES` and `TAB_STRING_LABELS`.

---

## Related

- [`lib/db.ts`](db.ts.md) — the row⇄type mapping (`rowToNote`, `rowToSummary`)
- [`lib/db-driver.ts`](db-driver.ts.md) — the DDL these types mirror
- [`lib/music/chords.ts`](music/chords.ts.md) — `ChordShape.frets` shares `TabHint.frets`' encoding
- [`lib/music/tunings.ts`](music/tunings.ts.md) — what `Note.tuning` indexes
- [`lib/strumming.ts`](strumming.ts.md) — `StrokeType`, the union `strummingPattern` declines to use
