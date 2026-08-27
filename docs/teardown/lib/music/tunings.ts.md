# `src/lib/music/tunings.ts`

**Role:** The eight guitar tunings the app knows, each as MIDI note numbers plus display labels.
**Size:** 61 lines. **Depends on:** nothing. Pure data.

---

## `Tuning`

```ts
export interface Tuning {
  id: string;
  label: string;
  midi: readonly [number, number, number, number, number, number];
  names: readonly [string, string, string, string, string, string];
}
```

**`id`** — the stable key stored in `Note.tuning` and `Settings.defaultTuning`. Slug-style (`"drop-d"`, `"half-down"`) so it's safe in JSON and URLs, and — critically — **decoupled from `label`**. Renaming a tuning's display text can never orphan existing notes.

**`label`** — what the picker shows. Includes the string spelling in parentheses (`"Drop D (DADGBe)"`) so a player can confirm at a glance without opening anything.

**`midi`** — the load-bearing field. **`names` is for display; `midi` is for maths.**

**Both are `readonly` 6-tuples**, in the low-E-first storage order that [`types.ts`](../types.ts.md) establishes for `TabColumn`, `TabHint.frets`, and `ChordShape.frets`. One convention across four types. `readonly` prevents accidental mutation of what is effectively a constant; the fixed length makes a five-element tuning a compile error.

---

## Why MIDI numbers

This is the design decision that makes the rest of the music layer possible.

MIDI note numbers are integers where **+1 = one semitone** and **60 = middle C**. Standard tuning is `[40, 45, 50, 55, 59, 64]` — E2, A2, D3, G3, B3, E4.

Because a fret is also one semitone, **the pitch of any note on the fretboard is one addition**:

```ts
const midi = tuning.midi[stringIndex] + fret;
```

That single line in [`chord-detect.ts`](chord-detect.ts.md) is the entire fretboard model. And pitch *class* — which note it is, ignoring octave — is `midi % 12`. Chord detection is arithmetic on integers, with no note-name string parsing anywhere in the hot path.

Storing names instead (`["E","A","D","G","B","e"]`) would force every calculation to parse a name, look up an index, add, handle wraparound, and re-render a name. Storing MIDI makes it addition and one modulo.

### Reading the intervals

Standard tuning's gaps: `40→45→50→55→59→64` = **5, 5, 5, 4, 5**. That's four perfect fourths, a major third between G and B, then a fourth. The irregular third is why guitar chord shapes aren't uniformly transposable across all string sets — and why `chords.ts` needs a shape *library* rather than a formula.

You can verify every tuning in the table by subtracting from standard:
- **Drop D** `[38,…]` — only index 0 changes, 40→38, the low E down a whole tone.
- **Half step down** — every value −1.
- **Full step down** — every value −2.
- **DADGAD** `[38,45,50,55,57,62]` vs standard — 6th −2, 2nd −2, 1st −2.

**Open tunings** (`open-g`, `open-e`, `open-d`) are the ones where the open strings themselves sound a chord. Check `open-g` = `[38,43,50,55,59,62]` → pitch classes `{2,7,2,7,11,2}` = `{D, G, B}` = a G major triad. That's what "open" means, and the MIDI encoding lets you confirm it by hand.

### `names` and the case convention

```ts
names: ["E", "A", "D", "G", "B", "e"]
```

Lowercase `"e"` at index 5 is the high E, uppercase `"E"` at index 0 the low. Same case-carries-meaning trick as `STRING_NAMES` in `types.ts` and `D`/`d` in `strumming.ts`. **Never `.toUpperCase()` these.**

Note `full-down` ends `["D","G","C","F","A","d"]` — lowercase `d` for the high string, consistent.

**`names` is redundant with `midi`** — you could derive `"Eb"` from `39`. It's stored anyway for one good reason: **enharmonic spelling**. MIDI 39 is equally D♯ or E♭, and the right choice depends on the tuning's musical context. `half-down` spells them flat (`"Eb", "Ab", "Db"`) because that's how guitarists write that tuning. `open-e` spells `"G#"` sharp. No algorithm gets this right from a number; a human decided per tuning. Same reason `transpose.ts` carries both a sharp and a flat scale.

---

## `TUNINGS` and `DEFAULT_TUNING`

```ts
export const TUNINGS: Tuning[] = [ /* 8 entries */ ];
export const DEFAULT_TUNING = TUNINGS[0];
```

An **array, not a `Record<string, Tuning>`** — because order is the picker's display order, and it's curated: standard first, then the two most common alternates (drop D, half step down), then progressively more exotic. A map would lose that and force a separate order array.

The cost: lookup by id is `TUNINGS.find(t => t.id === id)`, an O(8) scan. Irrelevant at this size.

**`DEFAULT_TUNING = TUNINGS[0]`** — derived rather than duplicated, so it can't drift from the array. Note it's the **same object reference** as `TUNINGS[0]`, not a copy — safe only because `midi` and `names` are `readonly`. Compare [`settings.ts`](../settings.ts.md), which *does* copy (`{ ...DEFAULT_SETTINGS }`) because those values are meant to be mutated by a form.

The string `"standard"` also appears as a literal in `settings.ts` (`defaultTuning: "standard"`), in the DDL (`DEFAULT 'standard'`), and in `rowToSummary`'s fallback (`r.tuning ?? "standard"`). Four places, unconnected. A `DEFAULT_TUNING.id` reference would tie them together; today the coupling is by convention.

---

## Control flow

None. No functions, no conditionals, no loops. A type, a data table, and one derived constant. All the behaviour lives in the consumers that do `tuning.midi[s] + fret`.

---

## Related

- [`lib/music/chord-detect.ts`](chord-detect.ts.md) — the sole consumer of `midi`; `tuning.midi[s] + frets[s]` is its whole fretboard model
- [`lib/types.ts`](../types.ts.md) — the low-E-first convention shared with `TabColumn` and `TabHint`
- [`lib/music/transpose.ts`](transpose.ts.md) — the same enharmonic problem, solved with two scales
- [`lib/settings.ts`](../settings.ts.md) — `defaultTuning` seeds new notes only
- [`components/notes/FingerFretboard.svelte`](../../components/notes/FingerFretboard.svelte.md) — renders `names` as string labels
