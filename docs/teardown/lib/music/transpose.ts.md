# `src/lib/music/transpose.ts`

**Role:** Shift chords, keys, and whole chord sheets up or down by semitones.
**Size:** 126 lines. **Depends on:** nothing. Pure functions, no I/O, no state.

The easiest file in `music/` to test in isolation — every function is `(input) => output` with no hidden state. A good first target if you want to poke at something in a REPL.

---

## The two scales

```ts
const SHARP_SCALE = ["A","A#","B","C","C#","D","D#","E","F","F#","G","G#"];
const FLAT_SCALE  = ["A","Bb","B","C","Db","D","Eb","E","F","Gb","G","Ab"];
```

Twelve semitones, **starting at A** rather than the more common C. Arbitrary but consistent — every index in this file is relative to A=0.

**Why two arrays for the same twelve pitches:** enharmonic equivalence. Index 1 is one physical pitch that is written `A#` in some keys and `B♭` in others. The correct spelling depends on the musical key, and a computer can't infer it from the pitch alone. Rather than implement key-signature theory, the module takes a `preferFlat` flag and lets the caller decide.

Note the naturals (`A`, `B`, `C`, `D`, `E`, `F`, `G`) are identical in both arrays — only the five accidentals differ. The two-array approach trades a little duplication for a lookup with no branching.

---

## `NOTE_TO_INDEX`

```ts
const NOTE_TO_INDEX: Record<string, number> = {
  A: 0, "A#": 1, Bb: 1, B: 2, Cb: 2, C: 3, "B#": 3, "C#": 4, Db: 4,
  D: 5, "D#": 6, Eb: 6, E: 7, Fb: 7, F: 8, "E#": 8, "F#": 9, Gb: 9,
  G: 10, "G#": 11, Ab: 11,
};
```

The **inverse** of the two scales — every spelling maps to its pitch class. Where the scales are one-to-one (index → one name each), this is many-to-one: `A#` and `Bb` both → 1.

**The interesting entries are the theoretical ones:**

| Entry | Why it's here |
|---|---|
| `Cb: 2` | C-flat sounds as B |
| `B#: 3` | B-sharp sounds as C |
| `Fb: 7` | F-flat sounds as E |
| `E#: 8` | E-sharp sounds as F |

These are the four spellings that cross a natural semitone (B–C and E–F have no black key between them). They're rare in guitar music but appear in correctly-notated sheet music, and including them means a chord sheet using proper theory spelling transposes rather than silently passing through unchanged. Four lines of data for real robustness.

**Output is never one of these** — `transposeNote` reads from `SHARP_SCALE`/`FLAT_SCALE`, which contain no double-crossing spellings. So the map accepts more than it produces: liberal in, conservative out.

**No `x`/`bb` (double accidentals)** and no lowercase. `bb` would be a genuine miss for some notation, but is vanishingly rare in guitar chord charts.

---

## `CHORD_RE`

```ts
// Root note followed by the rest of the chord quality (m, 7, sus4, maj7, ...)
const CHORD_RE = /^([A-G][#b]?)(.*)$/;
```

Two capture groups splitting a chord symbol into **root** and **quality**:

```
"Am7"    → root "A",  quality "m7"
"F#sus4" → root "F#", quality "sus4"
"Bb"     → root "Bb", quality ""
"C"      → root "C",  quality ""
```

- **`^([A-G][#b]?)`** — one letter A–G, optionally followed by one `#` or `b`. `?` makes the accidental optional. Anchored at `^` so the root must start the string.
- **`(.*)$`** — everything else, whatever it is. Greedy, matches to the end.

**The design insight: quality is never interpreted.** The regex doesn't enumerate `m`, `7`, `sus4`, `maj7`, `add9`, `13`, `m7b5`… it captures the remainder as an opaque string and reattaches it unchanged after transposing the root. That's why transposition works for chord qualities the app has never heard of — `Cm7b5#11` transposes correctly because only the `C` is touched.

**The known gap:** `(.*)` matches *anything*, so `"Cheese"` parses as root `C`, quality `"heese"`, and transposes to `"Dheese"`. Garbage in, garbage out. There's no validation, because in practice this only sees strings extracted from `[...]` markers by `parse.ts`, which does its own filtering.

**Note `[#b]` is case-sensitive** — an uppercase `B` as an accidental (`"AB"`) won't match as flat. Correct, since `b` is the flat symbol and `B` is a note.

---

## `mod12(n)`

```ts
function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}
```

**Four characters of arithmetic that fix a real bug.** JavaScript's `%` is a *remainder*, not a modulo — it keeps the sign of the dividend:

```js
 7 % 12  //  7   ✓
-5 % 12  // -5   ✗  we want 7
```

A negative index into `SHARP_SCALE` returns `undefined`, and the chord silently becomes `"undefinedm7"`. This happens the moment a user transposes *down* past A — an entirely ordinary action.

The `((n % 12) + 12) % 12` idiom:
1. `n % 12` → range `(-12, 12)`
2. `+ 12` → range `(0, 24)`, now guaranteed non-negative
3. `% 12` → range `[0, 12)`

The second `% 12` is what handles inputs that were already positive (`7 + 12 = 19`, `19 % 12 = 7`).

This is the standard JS modulo idiom and worth recognising on sight.

---

## `transposeNote(note, semitones, preferFlat)`

```ts
function transposeNote(note: string, semitones: number, preferFlat: boolean): string {
  const index = NOTE_TO_INDEX[note];
  if (index === undefined) return note;
  const scale = preferFlat ? FLAT_SCALE : SHARP_SCALE;
  return scale[mod12(index + semitones)];
}
```

The core operation: name → index → shift → name.

**`if (index === undefined) return note`** — the graceful-degradation guard. An unrecognised note passes through **unchanged** rather than throwing or returning `undefined`. That choice propagates upward: `transposeChordSheet` on a sheet with one odd symbol still transposes everything else, leaving the odd one alone. A throw would blank the whole song.

**`=== undefined`, not `!index`** — and this is essential. `NOTE_TO_INDEX["A"]` is `0`, which is falsy. `if (!index)` would treat A as unrecognised and refuse to transpose it. A classic falsy-zero bug, correctly avoided.

**`preferFlat ? FLAT_SCALE : SHARP_SCALE`** — the only place enharmonic spelling is decided. Note the *input* spelling doesn't influence the output: transposing `Bb` up 2 with `preferFlat = false` gives `C` (correct — no accidental), but `Bb` up 1 gives `B` in both scales, while `Bb` up 3 gives `C#` sharp-side and `Db` flat-side. The caller's flag wins entirely.

**`preferFlat` defaults to `false`** at the `transposeChord` boundary, so the app is sharp-preferring unless told otherwise. Guitar convention.

---

## `transposeChord(chord, semitones, preferFlat = false)`

The main export. Handles the full chord-symbol grammar including slash chords.

### Early exits

```ts
if (!chord || semitones === 0) return chord;
```

Two guards, one line.

**`!chord`** — empty string or undefined. Returns as-is rather than producing `"undefined"`.

**`semitones === 0`** — the identity case, and it's a real optimisation, not just tidiness. `transposeChordSheet` is called on every render of a transposed note; when the user hasn't transposed, this short-circuit skips the entire regex pipeline for every chord in the song. The same check appears again in `transposeChordSheet` to skip even the outer `.replace()`.

### Slash chords

```ts
const [main, bass] = chord.split("/");
```

A slash chord like `"C/G"` means "C major with G in the bass" — extremely common in guitar music (`G/B`, `D/F#`). Both halves are independent note names, so **both must transpose**.

`split("/")` with array destructuring gives `main` and `bass`; for a plain chord `bass` is `undefined`. Note this takes only the first two elements — `"C/G/E"` would silently drop the third. Not a real notation, so acceptable.

### The main part

```ts
const match = main.match(CHORD_RE);
if (!match) return chord;
const [, root, quality] = match;
let result = transposeNote(root, semitones, preferFlat) + quality;
```

**`if (!match) return chord`** — returns the **original `chord`**, not `main`. Subtle and correct: bailing out must not silently drop the bass note.

**`const [, root, quality]`** — array destructuring with a hole. `match[0]` is the full match, which isn't needed; the leading comma skips it. Idiomatic for regex results.

**`transposeNote(root, …) + quality`** — root shifted, quality reattached verbatim. The whole trick.

### The bass part

```ts
if (bass !== undefined) {
  const bassMatch = bass.match(CHORD_RE);
  if (bassMatch) {
    const [, bassRoot, bassQuality] = bassMatch;
    result += "/" + transposeNote(bassRoot, semitones, preferFlat) + bassQuality;
  } else {
    result += "/" + bass;
  }
}
```

**`bass !== undefined`, not `if (bass)`** — an empty-string bass (from a trailing `"C/"`) is still "there was a slash," and the check preserves it. Pedantic, but consistent with the file's care around falsy values.

**The nested if/else is the important part.** Unlike the main chord — where a parse failure aborts everything — a bass that doesn't parse is **kept verbatim** and appended after the slash. So `"C/weird"` becomes `"D/weird"`: the part that could transpose did, the part that couldn't was preserved. Maximum-effort degradation rather than all-or-nothing.

`bassQuality` is captured and reattached too, so `"C/G7"` works.

**`let result` accumulated with `+=`** — string building across two branches. The only mutable local in the file.

---

## `transposeKey(key, semitones)`

```ts
export function transposeKey(key: string, semitones: number): string {
  return transposeChord(key, semitones);
}
```

A **semantic alias**. A key label (`"Am"`, `"F#m"`) has the same grammar as a chord symbol, so the implementation is identical.

It exists so call sites read correctly: `transposeKey(note.key, n)` at the header, `transposeChord(...)` in the body. The intent is visible without reading the argument. Costs one function, buys readability — and leaves room for the two to diverge later (a key could reasonably prefer flats based on the key signature, which a chord in isolation can't know).

Note it **doesn't forward `preferFlat`**, so keys are always sharp-spelled. A minor inconsistency: transposing to the key of D♭ displays "C#". Arguably wrong musically, but consistent with the rest of the app.

---

## `transposeChordSheet(sheet, semitones)`

```ts
export function transposeChordSheet(sheet: string, semitones: number): string {
  if (semitones === 0) return sheet;
  return sheet.replace(/\[([^\]]+)\]/g, (_, chord: string) => {
    return `[${transposeChord(chord.trim(), semitones)}]`;
  });
}
```

> *"Transpose every inline `[Chord]` marker in a chord sheet by `semitones`. Lyrics between markers are left untouched."*

**`if (semitones === 0) return sheet`** — skips the whole regex pass on the common untransposed case, before even allocating.

### The regex `/\[([^\]]+)\]/g`

- `\[` `\]` — literal brackets, escaped because they're regex metacharacters.
- `([^\]]+)` — one or more characters that are **not** a closing bracket. This is a **negated character class**, which is the correct tool here: it can't run past the first `]`, so it's inherently non-greedy without needing `+?`. On `"[Am] and [C]"` it matches `[Am]` and `[C]` separately, never `[Am] and [C]` as one.
- `+` not `*` — an empty `[]` doesn't match, so it's left alone rather than becoming `[]`.
- `/g` — every occurrence.

### The replacer function

```ts
(_, chord: string) => `[${transposeChord(chord.trim(), semitones)}]`
```

**`_` skips the full match.** `String.prototype.replace` passes `(fullMatch, group1, group2, …, offset, string)`; only group 1 is wanted. Naming it `_` is the convention for "deliberately unused."

**`.trim()`** — tolerates `[ Am ]`. Note the *output* is always tight (`[Am]`), so transposing normalises whitespace as a side effect.

**Brackets are re-added by the template literal.** The regex consumed them; the replacement restores them.

### What this does *not* do

It transposes **every** bracketed token, including section headers. `"[Verse 1]"` goes through `transposeChord`, which fails `CHORD_RE`... actually `"Verse 1"` *does* match (`V` isn't A–G, so no — it fails at `[A-G]`). Good: section headers pass through unchanged via the `if (!match) return chord` guard.

But `"[Bridge]"` **does** match — root `B`, quality `"ridge"` — and transposing up 2 yields `"[Cridge]"`. **A real bug.** [`parse.ts`](parse.ts.md) has an entire `NON_CHORD_LABELS` set and `isNonChordLabel()` helper to solve exactly this problem for chord *extraction*, and this function doesn't use it. Worth verifying against the running app: write a sheet with `[Bridge]` on its own line and transpose.

The same applies to `[tab: Solo]` references — `t` isn't A–G, so those are safe by luck.

---

## `formatSemitones(semitones)`

```ts
export function formatSemitones(semitones: number): string {
  if (semitones === 0) return "0";
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}
```

Pure display formatting. Three cases:

| Input | Output | Why |
|---|---|---|
| `0` | `"0"` | Not `"+0"` — a plus on zero reads as an offset when there isn't one |
| `2` | `"+2"` | The `+` must be added; `String(2)` is `"2"` |
| `-1` | `"-1"` | The `-` comes free from number→string coercion |

**The asymmetry is the whole function.** JavaScript renders the minus sign but not the plus, so only the positive branch needs work. Being explicit about zero avoids the awkward `"+0"`.

The `${semitones}` in the negative branch is just `String(semitones)` — template-literal form chosen for visual symmetry with the branch above it.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `((n % 12) + 12) % 12` | `mod12` | JS `%` keeps the dividend's sign — breaks downward transposition |
| `if (index === undefined)` | `transposeNote` | `=== undefined` not `!index`, because A is index 0 |
| `preferFlat ? FLAT : SHARP` | `transposeNote` | Enharmonic spelling is the caller's choice |
| `if (!chord \|\| semitones === 0)` | `transposeChord` | Identity short-circuit, hit on every untransposed render |
| `if (!match) return chord` | `transposeChord` | Return the *original*, preserving any bass note |
| nested `if (bassMatch)` / `else` | `transposeChord` | Partial success beats total failure |
| `if (semitones === 0)` | `transposeChordSheet` | Skip the whole regex pass |
| `if (semitones === 0)` / ternary | `formatSemitones` | JS prints `-` but not `+` |

**No loops at all.** Iteration happens inside `String.replace`, which is the only place multiple items are processed.

---

## The theme

Every branch in this file is a **graceful-degradation guard**. Unrecognised note → return it. Unparseable chord → return it. Unparseable bass → keep it after the slash. Nothing throws, nothing returns `null`. The reasoning: this runs over user-authored text on every render, and a song that renders slightly wrong is far better than a song that doesn't render.

---

## Related

- [`lib/music/chords.ts`](chords.ts.md) — calls `transposeChord` in a 11×N search to derive unknown shapes
- [`lib/music/parse.ts`](parse.ts.md) — has the `isNonChordLabel` filter this file arguably needs
- [`lib/music/tunings.ts`](tunings.ts.md) — the same enharmonic problem, solved by hand-spelling
- [`components/notes/NoteReader.svelte`](../../components/notes/NoteReader.svelte.md) — the transpose UI
