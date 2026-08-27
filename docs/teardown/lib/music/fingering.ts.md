# `src/lib/music/fingering.ts`

**Role:** Works out *which finger presses which string* — for a chord shape, and for a tab fragment played as a sequence of hand positions.
**Size:** 238 lines. **Depends on:** `@/lib/types` (type only), `./chords` (type only).

This is the file that encodes **how a hand actually works**. Everything else in `music/` is about pitch; this is about ergonomics.

---

## Finger vocabulary

```ts
export type Finger = 1 | 2 | 3 | 4;

export const FINGER_LABELS: Record<Finger, string> = {
  1: "index", 2: "middle", 3: "ring", 4: "pinky",
};

export const FINGERS: Finger[] = [1, 2, 3, 4];
```

**Numeric literal union, 1–4.** The standard guitar numbering. The thumb is deliberately absent — thumb-over-the-top fretting exists but isn't modelled; a `TabHint.note` free-text field is where that advice goes.

`Record<Finger, string>` forces every finger to have a label, the same exhaustiveness trick as `STROKE_DISPLAY` in [`strumming.ts`](../strumming.ts.md).

**`FINGERS` exists separately from the type** because you can't iterate a type at runtime. `FINGERS.map(...)` in a legend component needs a real array.

---

## `StringState`

```ts
export type StringState = number | null;
```

> *"null = not played, -1 = muted, 0 = open, n = fretted at n."*

**A fourth encoding of the same concept**, and it's worth laying all four side by side because confusing them is the main hazard in this layer:

| Concept | `TabColumn` | `TabHint.frets` / `ChordShape.frets` | `chord-detect` | `StringState` |
|---|---|---|---|---|
| untouched | `""` | — | `UNSET_FRET` (−2) | `null` |
| muted | `"x"` | `-1` | `-1` | `-1` |
| open | `"0"` | `0` | `0` | `0` |
| fretted | `"5"` | `5` | `5` | `5` |

`StringState` is the **internal working form**: numeric like `ChordShape.frets` (so arithmetic works), but with `null` for "untouched" (which `ChordShape` has no need for, since a chord always decides every string). `parseTabCell` below is the converter from the string form.

All four share the low-E-first index order, restated in this file's comment for the fourth time. The repetition across files is deliberate — it's the convention most likely to be got wrong.

---

## `Fingering` and `FingeredNote`

```ts
export interface Fingering {
  fingers: [number, number, number, number, number, number];
  barre?: { fret: number; from: number; to: number; finger: Finger };
  position: number;
}
```

**`fingers`** — parallel to `frets`, one entry per string. `0` means no finger (open, muted, or unplayed). Note the element type is `number`, not `Finger`, precisely so `0` is representable. The union stays for the *values* that matter.

**`barre`** — extends `ChordShape`'s barre with a `finger` field. `ChordShape.barre` says *where* the bar is; this says *which finger* lies flat.

**`position`** — *"Fret the index finger sits at — the hand position."* This is the concept that makes the tab logic work. A guitarist doesn't think "fret 7"; they think "5th position, ring finger." Position is the anchor everything else is relative to.

```ts
export interface FingeredNote { string: number; fret: number; finger: Finger; }
```

A flattened, iterable form of the same information — used where a component wants a list to render rather than six parallel arrays.

---

## `FRET_SPAN` and the helpers

```ts
const FRET_SPAN = 4;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const emptyFingers = (): Fingering["fingers"] => [0, 0, 0, 0, 0, 0];
```

**`FRET_SPAN = 4` is the central physical constant of the file.** Four fingers, four consecutive frets — that's the reach of a hand without moving. It appears in five places and every one of them means the same thing. If you only remember one number from this file, it's this.

**`clamp`** — `Math.min(hi, Math.max(lo, n))`. The nesting order matters: `max` first raises to the floor, `min` then lowers to the ceiling. Used to keep computed finger numbers inside 1–4.

**`emptyFingers()` is a function, not a constant** — the same fresh-object discipline as `emptyPattern()` in `strumming.ts` and `{ ...DEFAULT_SETTINGS }` in `settings.ts`. A shared array would be mutated by the first caller and corrupt every subsequent fingering.

---

## `fingerShape(frets, opts)` — the core algorithm

> *"The hand can only reach four frets at once, so fingers follow the frets in order: the lowest fret gets the lowest available finger and each note further up the neck takes the next one. Two notes on the same fret still need two fingers (a power chord's root and fifth are ring and pinky, not ring twice) unless there are more notes than fingers, in which case the lowest fret is barred."*

That comment is the specification. The code implements it in six steps.

### Step 1 — collect the pressed notes

```ts
const fingers = emptyFingers();
const pressed: { string: number; fret: number }[] = [];

frets.forEach((fret, string) => {
  if (fret !== null && fret > 0) pressed.push({ string, fret });
});
if (pressed.length === 0) return { fingers, position: 0 };
```

**`fret !== null && fret > 0`** — two conditions collapsing three non-cases. `null` (untouched), `-1` (muted), and `0` (open) all require no finger. Strictly `fret > 0` alone would suffice (`null > 0` is `false`), but the explicit null check documents the intent and guards against `null` coercion surprises.

**The early return** for a shape with nothing fretted: all-zero fingers, `position: 0`. That `0` is the sentinel meaning "no hand position" — `tabPositions` below skips on exactly this value.

### Step 2 — the fret window

```ts
const minFret = Math.min(...pressed.map((p) => p.fret));
const maxFret = Math.max(...pressed.map((p) => p.fret));
```

The lowest and highest frets the shape touches. Two passes over a ≤6-element array; readability over micro-optimisation.

### Step 3 — the anchor decision

```ts
const anchor =
  opts.anchor && opts.anchor <= minFret && maxFret - opts.anchor < FRET_SPAN
    ? opts.anchor
    : minFret;
```

> *"Only trust the caller's position if the hand can actually reach this shape from there; otherwise the hand has moved and this shape sets the position."*

**Three conditions, all required:**

1. **`opts.anchor`** — truthy. Note this treats `anchor: 0` as absent, which is correct: fret 0 isn't a hand position. (This is why `tabSteps` passes `anchors[i] || undefined`.)
2. **`opts.anchor <= minFret`** — the hand can't be *above* the lowest note it has to play. An anchor at fret 7 can't reach a note at fret 5.
3. **`maxFret - opts.anchor < FRET_SPAN`** — the highest note is within four frets of the anchor. Strict `<` because the span is inclusive: anchor 5 covers frets 5, 6, 7, 8, so `maxFret = 8` gives `8 - 5 = 3 < 4` ✓, while `maxFret = 9` gives `4 < 4` ✗.

**Why this matters** — the comment's example: *"a note on fret 7 played out of 5th position gets the ring finger rather than the index."* Without the anchor, every isolated note in a tab would be assigned the index finger, because its own `minFret` is its own fret. Threading position through a phrase is what makes the fingering read like real playing.

**Falls back to `minFret`** — this shape defines its own position.

### Step 4 — determine the barre

```ts
let barre = opts.barre?.fret === minFret ? opts.barre : undefined;
if (!barre && pressed.length > FRET_SPAN) {
  const onMin = pressed.filter((p) => p.fret === minFret);
  if (onMin.length > 1) {
    barre = {
      fret: minFret,
      from: Math.min(...onMin.map((p) => p.string)),
      to: Math.max(...onMin.map((p) => p.string)),
    };
  }
}
```

> *"A barre is either declared by the shape or forced on us by running out of fingers… Only the lowest fret of a shape can be barred — the finger underneath the others is the one that lies flat."*

**Two sources of a barre.**

**(a) Declared** — `opts.barre` from a `ChordShape`. But note the guard: **`opts.barre?.fret === minFret`**. A declared barre is only honoured if it's at the shape's lowest fret. That's the physical constraint in the comment — you bar with the finger that's *underneath* the others, so it must be the lowest. A declared barre elsewhere is discarded as nonsense.

**(b) Forced** — `pressed.length > FRET_SPAN`, i.e. **more than four notes to press with four fingers**. Something must double up, and the only way to press two strings with one finger is to bar them.

**`onMin.length > 1`** — a barre requires at least two strings on that fret. If more than four notes are pressed but only one sits at the lowest fret, no barre is possible and the code proceeds without one (the clamping in step 6 will then reuse finger 4 for the excess).

**`from`/`to` from min/max string index** — the bar spans from the lowest to the highest string on that fret. Note this can span strings that *aren't* on the barred fret; the `barred()` predicate below re-filters.

### Step 5 — assign the barre finger

```ts
const barred = (p) => !!barre && p.fret === barre.fret && p.string >= barre.from && p.string <= barre.to;
const barredNotes = barre ? pressed.filter(barred) : [];
const barreFinger = clamp(barre ? barre.fret - anchor + 1 : 1, 1, FRET_SPAN) as Finger;

let lastFinger = 0;
if (barredNotes.length > 0) {
  for (const p of barredNotes) fingers[p.string] = barreFinger;
  lastFinger = barreFinger;
}
```

**`barred` is a predicate closure** — a note is barred if it's on the bar's fret *and* within its string span. The `!!barre` handles the undefined case so the predicate is safe to pass to `filter` unconditionally (though the caller guards anyway).

**`barre.fret - anchor + 1` — the reach formula**, and it appears again in step 6. It converts an absolute fret to a finger number relative to the hand position:

```
anchor = 5, fret = 5  →  5 - 5 + 1 = 1  (index)
anchor = 5, fret = 7  →  7 - 5 + 1 = 3  (ring)
anchor = 5, fret = 8  →  8 - 5 + 1 = 4  (pinky)
```

The `+ 1` is because fingers are 1-based while the offset is 0-based. Clamped to 1–4 so a note outside the span still gets a usable finger.

For a barre this is almost always 1 (the bar is at `minFret`, and `anchor` is usually `minFret`), but the formula handles the anchored case where a bar sits above the hand position.

**`lastFinger` starts at 0** and is set to the barre finger if a barre exists. It's the running "highest finger used so far," which drives the sequential assignment below.

### Step 6 — assign the remaining fingers

```ts
const rest = pressed
  .filter((p) => !barredNotes.includes(p))
  .sort((a, b) => a.fret - b.fret || a.string - b.string);

for (const p of rest) {
  const reach = clamp(p.fret - anchor + 1, 1, FRET_SPAN);
  const finger = clamp(Math.max(reach, lastFinger + 1), 1, FRET_SPAN);
  fingers[p.string] = finger;
  lastFinger = finger;
}
```

> *"Low frets first, and low strings before high ones on a shared fret — that is the order the fingers stack up in."*

**The sort is the algorithm's backbone.** `a.fret - b.fret || a.string - b.string` is the standard two-key comparator: sort by fret ascending; on equal frets, by string ascending. The `||` works because a comparator returns `0` for "equal," which is falsy, so the second key is consulted only on ties.

Processing in this order means fingers get assigned in the order they physically stack up the neck.

**`!barredNotes.includes(p)`** — object identity comparison. Safe because `barredNotes` holds the *same object references* from `pressed` (via `filter`, not a map). If anything had copied those objects, this would silently fail. A subtle dependency worth noticing.

**`Math.max(reach, lastFinger + 1)` — the two competing constraints:**

- **`reach`** — which finger *should* press this fret, based on hand position.
- **`lastFinger + 1`** — the next unused finger, because each finger presses at most one note.

Taking the max satisfies both. The comment's example: *"a power chord's root and fifth are ring and pinky, not ring twice."* Two notes on **the same fret**, one string apart:

```
anchor 5, both at fret 7:
  note A: reach = 3, lastFinger + 1 = 1  →  max = 3 (ring),  lastFinger = 3
  note B: reach = 3, lastFinger + 1 = 4  →  max = 4 (pinky)
```

Without `lastFinger + 1`, both would get finger 3 — one finger pressing two strings, which is a barre, which isn't what a power chord is.

**The outer `clamp`** catches the case where `lastFinger + 1` exceeds 4 (more than four notes and no barre was formed). The excess notes all get finger 4. Physically impossible, but it degrades to *something* rather than producing finger 5 or 7. A graceful-degradation choice consistent with the rest of the music layer.

### Step 7 — assemble

```ts
barre: barredNotes.length > 1 && barre
  ? { fret: barre.fret, from: Math.min(...barredNotes.map(p => p.string)),
      to: Math.max(...barredNotes.map(p => p.string)), finger: barreFinger }
  : undefined,
position: anchor,
```

**`barredNotes.length > 1`** — the barre is only *reported* if it actually covers two or more notes. A "barre" over one note is just a finger.

**`from`/`to` are recomputed from `barredNotes`**, not copied from `barre`. This tightens the span: step 4's `from`/`to` came from all notes at `minFret`, but `barredNotes` is the filtered set, so the reported bar spans exactly the strings it really covers.

**`position: anchor`** — either the caller's (if reachable) or this shape's own `minFret`.

---

## `fingerChord(shape)`

```ts
export function fingerChord(shape: ChordShape): Fingering {
  return fingerShape(shape.frets, { barre: shape.barre });
}
```

A one-line adapter from the chord library's `ChordShape` to the generic `fingerShape`. No `anchor` — a chord is a standalone grip with no phrase context. Exists so callers dealing in chords don't have to know about `opts`.

---

## `parseTabCell(value)`

```ts
export function parseTabCell(value: string): StringState {
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  if (v === "x") return -1;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
```

**The `TabColumn` (string) → `StringState` (number|null) converter.**

**`.trim().toLowerCase()`** — tolerates `" X "` and `"X"`. Note this is a place where lowercasing is *safe*, unlike the case-sensitive `StrokeType` and string-name conventions elsewhere.

**Three explicit cases, in order:** empty → `null`; `"x"` → `-1`; otherwise parse.

**`Number.parseInt(v, 10)`** — explicit radix. Without it, a leading `0` could historically be read as octal; modern engines don't, but passing 10 is the habit that prevents the question.

**`Number.isNaN(n) ? null : n`** — garbage (`"abc"`) degrades to `null` (untouched) rather than throwing. **`Number.isNaN`, not global `isNaN`** — the global coerces its argument first (`isNaN("abc")` is `true` for the wrong reason), while `Number.isNaN` only returns true for the actual `NaN` value. The correct choice, and a distinction worth knowing.

**A quirk:** `parseInt("12abc")` returns `12`. So `"12abc"` parses as fret 12 rather than degrading. Lenient, consistent with the file's general tolerance.

**Negative input:** `"-5"` parses to `-5`, which downstream code will read as "not played" (`fret > 0` fails) rather than muted. An unreachable case given the editor's input, but unguarded.

---

## `columnIsPlayed(column)`

```ts
export function columnIsPlayed(column: TabColumn): boolean {
  return column.some((cell) => parseTabCell(cell) !== null);
}
```

> *"True when the column asks the player to do something."*

**`!== null` means "not untouched."** So a column that's entirely muted (`x` on every string) *is* played — a deliberate mute is an action, and it occupies a beat. Only a completely empty column is skipped.

`.some()` short-circuits on the first non-null.

---

## `tabSteps(columns)` — segmenting a phrase into hand positions

> *"Fingering a run note by note would put the index finger on every note, so the phrase is first cut into hand positions: consecutive notes stay in one position for as long as the four fingers can cover all of them… A run of 5-7-8 then comes out as index-ring-pinky, and the position only shifts where the hand really has to move."*

**The problem:** call `fingerShape` on each column independently and every single-note column has `minFret === maxFret`, so `anchor = minFret` and the note gets finger 1. A run of 5-7-8 reads as index-index-index — useless.

**The solution:** a greedy sweep that groups consecutive columns into position windows, then fingers each column *with its group's anchor*.

### Filtering to played columns

```ts
const played = columns
  .map((column, index) => ({ column: index, frets: column.map(parseTabCell) }))
  .filter((step) => step.frets.some((f) => f !== null));
```

`map` **before** `filter`, so the original index is captured in `column: index` before any rows are dropped. Getting this backwards would renumber the columns and break `tabPositions`' `fromColumn`/`toColumn`.

The filter is `columnIsPlayed` inlined.

### The greedy position sweep

```ts
const anchors = new Array<number>(played.length).fill(0);
let start = 0;
let low = Infinity;
let high = -Infinity;

const closePosition = (end: number) => {
  for (let k = start; k < end; k++) anchors[k] = Number.isFinite(low) ? low : 0;
};
```

**`anchors`** is a parallel array, one entry per played column. `new Array(n).fill(0)` — the same sparse-array hazard as `emptyPattern()`; `fill` is required to make it dense.

**`low`/`high`** track the fret range of the *current* position window. Initialised to `Infinity`/`-Infinity` so the first `Math.min`/`Math.max` takes the real value.

**`closePosition(end)`** writes the window's anchor into every column from `start` to `end - 1`. **`Number.isFinite(low) ? low : 0`** guards the case where the window contained no fretted notes at all (only opens/mutes) — `low` would still be `Infinity`, and writing that as an anchor would break everything downstream.

### The loop

```ts
for (let i = 0; i < played.length; i++) {
  const own = played[i].frets.filter((f): f is number => f !== null && f > 0);
  if (own.length === 0) continue;

  const nextLow = Math.min(low, ...own);
  const nextHigh = Math.max(high, ...own);
  if (nextHigh - nextLow >= FRET_SPAN) {
    closePosition(i);
    start = i;
    low = Math.min(...own);
    high = Math.max(...own);
  } else {
    low = nextLow;
    high = nextHigh;
  }
}
closePosition(played.length);
```

**`(f): f is number` — a type predicate.** It tells TypeScript that the filtered array is `number[]`, not `(number|null)[]`, so the spread into `Math.min` typechecks. Without it you'd need a cast. A neat use of a narrowing signature on a filter callback.

**`if (own.length === 0) continue`** — per the comment: *"Columns that only mute or ring open belong to whichever position they fall inside; they never move the hand."* An open-string column doesn't constrain the hand at all, so it's skipped for window purposes but still receives whatever anchor its window ends up with. That's why the loop `continue`s rather than closing the window.

**The window test — `nextHigh - nextLow >= FRET_SPAN`** — would adding this column's notes make the window wider than the hand can reach?

- **Yes** → close the current window (`closePosition(i)` covers columns `start`…`i-1`), start a new one at `i` seeded with *only this column's* range.
- **No** → extend the window.

**Note the tentative `nextLow`/`nextHigh` are computed before the test**, then either committed (else branch) or discarded (if branch re-seeds from `own` alone). That's what makes the greedy decision correct: you test the *hypothetical* extended window, not the already-mutated one.

**`>=` not `>`** — a window from fret 5 to fret 9 is `9 - 5 = 4`, which spans five frets (5,6,7,8,9) and needs five fingers. Correctly rejected.

**`closePosition(played.length)` after the loop** — flushes the final window, which has no successor to trigger it.

**Greedy, not optimal.** It extends a window as far as possible before breaking. A globally optimal segmentation (fewest position shifts) would need dynamic programming. Greedy matches how a player actually reads a phrase — you stay put until you can't — so it's arguably the *right* answer rather than merely the cheap one.

### Applying the anchors

```ts
return played.map((step, i) => ({
  ...step,
  fingering: fingerShape(step.frets, { anchor: anchors[i] || undefined }),
}));
```

**`anchors[i] || undefined`** — converts a `0` anchor to `undefined`, because `fingerShape`'s first condition (`opts.anchor &&`) treats `0` as absent anyway. Passing `undefined` explicitly is clearer than relying on the falsy check downstream. This is the one place `||` is preferred over `??` in this layer, and correctly so: `0` is exactly the value being filtered.

---

## `fingeredNotes(frets, fingering)`

```ts
export function fingeredNotes(frets, fingering): FingeredNote[] {
  const notes: FingeredNote[] = [];
  for (let s = 5; s >= 0; s--) {
    const fret = frets[s];
    const finger = fingering.fingers[s];
    if (fret !== null && fret > 0 && finger > 0) {
      notes.push({ string: s, fret, finger: finger as Finger });
    }
  }
  return notes;
}
```

> *"The fretted notes of a shape, **high-e string first** to read like a tab."*

**The descending loop (`s = 5; s >= 0; s--`) is the display-order reversal** that [`types.ts`](../types.ts.md) warns about. Storage is low-E-first; tablature is drawn high-e on top. Rather than build the array and reverse it, the loop simply counts down.

This is the *fourth* place in the codebase where storage order flips to display order (alongside `TAB_STRING_LABELS` and the renderers). Recognising the pattern is what makes those components readable.

**The triple condition** — `fret !== null && fret > 0 && finger > 0` — filters to genuinely fingered notes. The `finger > 0` check is what excludes open strings, which have a fret of 0 anyway; belt and braces.

**`finger as Finger`** — a narrowing cast from `number`. Sound because the `finger > 0` guard plus `fingerShape`'s clamping guarantee 1–4, but the compiler can't see that.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `fret !== null && fret > 0` | `fingerShape` step 1 | Collapse null/muted/open into "no finger" |
| `if (pressed.length === 0)` | step 1 | Nothing fretted ⇒ `position: 0` sentinel |
| 3-part anchor ternary | step 3 | Trust the caller's position only if the hand can reach |
| `opts.barre?.fret === minFret` | step 4 | Only the lowest fret can be barred — physics |
| `pressed.length > FRET_SPAN` | step 4 | More notes than fingers ⇒ forced barre |
| `if (onMin.length > 1)` | step 4 | A one-note "barre" is just a finger |
| `.sort(fret \|\| string)` | step 6 | Fingers stack low-fret-first, low-string-first |
| `Math.max(reach, lastFinger + 1)` | step 6 | Reach vs. one-note-per-finger, satisfy both |
| `clamp(..., 1, FRET_SPAN)` | steps 5–6 | Degrade gracefully past four fingers |
| `barredNotes.length > 1` | step 7 | Only report a real barre |
| `if (own.length === 0) continue` | `tabSteps` | Open/muted columns never move the hand |
| `nextHigh - nextLow >= FRET_SPAN` | `tabSteps` | Greedy position-window break |
| `(f): f is number` | `tabSteps` | Type predicate so the spread typechecks |
| `Number.isFinite(low) ? low : 0` | `closePosition` | Window with no fretted notes |
| `anchors[i] \|\| undefined` | `tabSteps` | `0` is "no position", not fret zero |
| `for (s = 5; s >= 0; s--)` | `fingeredNotes` | Storage order → tab display order |

---

## Related

- [`lib/music/tab-shapes.ts`](tab-shapes.ts.md) — the main consumer; suggests grips using `fingerShape` and `tabSteps`
- [`lib/music/chords.ts`](chords.ts.md) — `ChordShape`, fed in via `fingerChord`
- [`lib/types.ts`](../types.ts.md) — `TabColumn`, and the low-E-first convention
- [`components/notes/FingerFretboard.svelte`](../../components/notes/FingerFretboard.svelte.md) — draws a `Fingering`
- [`components/notes/FingerLegend.svelte`](../../components/notes/FingerLegend.svelte.md) — uses `FINGERS` and `FINGER_LABELS`
