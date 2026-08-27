# `src/lib/music/tab-shapes.ts`

**Role:** Answers *"where do I put my hand to play this tab?"* — suggests chord grips that hold as much of a tab fragment as possible, and splits a fragment into the hand positions it actually needs.
**Size:** 205 lines. **Depends on:** `@/lib/types`, `./chords`, `./fingering`.

The top of the music-layer stack. It consumes [`chords.ts`](chords.ts.md)'s catalogue and [`fingering.ts`](fingering.ts.md)'s hand model to produce authoring advice.

---

## What problem this solves

A tab tells you which notes to play. It doesn't tell you where to put your hand — and an experienced player reads a riff and *recognises* it: "that's just an Em shape." A beginner doesn't. This file automates that recognition, feeding the `TabHint` feature described in [`types.ts`](../types.ts.md).

---

## `TabDemand`, `ShapeCoverage`, `ShapeMatch`

```ts
export interface TabDemand {
  notes: { string: number; fret: number }[];
  open: number[];
  lowestFret: number;
  highestFret: number;
}
```

> *"Everything a tab fragment asks the fretting hand to do."*

**The tab collapsed across time.** A tab is a sequence of columns; a grip is one static hand position. To compare them, the *when* has to be discarded — what's left is the set of distinct string+fret pairs the fragment ever touches.

**`open` is tracked separately from `notes`** and that separation is essential. An open string is something the grip must **not block** — a demand for absence rather than presence. It's scored as `blocked`, not as an uncovered note.

```ts
export interface ShapeCoverage {
  covered: number;   // tab notes this grip already holds
  total: number;     // tab notes overall
  extra: number;     // notes the grip frets that the tab never plays
  blocked: number;   // strings the tab needs open that the grip blocks
}
```

Four numbers, all comparable across grips. `covered/total` is the fit; `extra` and `blocked` are the costs.

```ts
export interface ShapeMatch extends ShapeCoverage {
  name: string; label: string;
  frets: [number, number, number, number, number, number];
  fingering: Fingering;
}
```

**`name` vs `label`** — `"Am"` vs `"Am (5fr)"`. Kept separate because the name is the identity (used for dedup and comparison) while the label is presentation.

---

## `tabDemand(columns)`

```ts
const seen = new Set<string>();
const notes: { string: number; fret: number }[] = [];
const open = new Set<number>();
let lowestFret = Infinity;
let highestFret = 0;

for (const column of columns) {
  column.forEach((cell, string) => {
    const fret = parseTabCell(cell);
    if (fret === null || fret < 0) return;
    if (fret === 0) { open.add(string); return; }
    lowestFret = Math.min(lowestFret, fret);
    highestFret = Math.max(highestFret, fret);
    const key = `${string}:${fret}`;
    if (seen.has(key)) return;
    seen.add(key);
    notes.push({ string, fret });
  });
}
```

**A nested loop** — `for...of` over columns, `.forEach` over the six cells. The `forEach` is used because it supplies the string index; the outer is `for...of` because the column index isn't needed.

**`return` inside `forEach` acts as `continue`** for that cell. Three of them, forming a filter cascade.

### The three-way cell classification

1. **`fret === null || fret < 0`** — untouched or muted. **Neither is a demand.** A muted string is not "keep this open"; the grip may freely fret it, because a muted string is silenced by the picking hand anyway. Skipping mutes rather than treating them as constraints is a real musical judgement, and it makes far more grips eligible.

2. **`fret === 0`** — open. Added to `open`, then `return` so it never enters `notes` or the fret range. Correct: an open string has no fret position and shouldn't drag `lowestFret` to zero.

3. **Otherwise** — a fretted note. Range updated, then deduplicated.

### Dedup by `"string:fret"`

```ts
const key = `${string}:${fret}`;
```

A tab plays the same note repeatedly — a riff might hit fret 7 on the D string eight times. For "can one grip hold this?", that's **one** demand, not eight. Without dedup, `covered/total` would be weighted by repetition rather than by distinct positions, and a grip covering one frequently-repeated note would outrank one covering three distinct notes.

**Same dedup-by-composite-key idiom** as `chordShapeCatalog`'s `frets.join(",")` in `chords.ts`. Note the `Set` holds strings, not objects — `notes` holds the objects, `seen` holds their keys.

**Range tracking happens before the dedup check**, so a repeated note still (harmlessly) updates the min/max. Correct either way, since it's already been counted once.

### The return

```ts
open: [...open].sort((a, b) => a - b),
lowestFret: Number.isFinite(lowestFret) ? lowestFret : 0,
highestFret,
```

**`[...open].sort((a, b) => a - b)`** — Set to array, sorted numerically. **The comparator is mandatory**: JavaScript's default sort converts to strings, so `[2, 10]` would sort to `[10, 2]`. A classic bug, correctly avoided.

**`Number.isFinite(lowestFret) ? lowestFret : 0`** — the same guard as `closePosition` in `fingering.ts`. If the tab has no fretted notes at all (only opens and mutes), `lowestFret` is still `Infinity` and would poison every downstream comparison.

`highestFret` needs no guard because it initialises to `0`, which is already a sane floor.

---

## `shapeLabel(name, shape)`

```ts
const shapeLabel = (name: string, shape: ChordShape) => {
  if (shape.frets.includes(0)) return name;
  const lowest = Math.min(...shape.frets.filter((f) => f > 0));
  return lowest > 1 ? `${name} (${lowest}fr)` : name;
};
```

> *"Grips that lean on open strings live at one place on the neck, so their name is enough. Movable ones need to say where the hand goes."*

**`frets.includes(0)`** — the same movability test as `isMovable` in [`chords.ts`](chords.ts.md), inverted. An open-string shape can only exist at one position, so `"Em"` is unambiguous. A barre shape can be anywhere, so `"Am"` alone is useless — hence `"Am (5fr)"`.

**`lowest > 1`** — a movable shape already at fret 1 doesn't need the annotation; `"F"` is understood to be at the nut. Avoids the noise of `"F (1fr)"`.

**`.filter(f => f > 0)`** before `Math.min` — excludes `-1` (muted), which would otherwise always be the minimum. Same filter as `shiftShape` in `chords.ts`, for the same reason.

**The `Infinity` edge case** exists here too (all strings muted), but is unreachable: the function only runs on catalogue shapes, which are real chords.

---

## `shapeCoverage(frets, demand)`

```ts
let covered = 0;
for (const note of demand.notes) {
  if (frets[note.string] === note.fret) covered++;
}

let extra = 0;
for (let s = 0; s < 6; s++) {
  const fret = frets[s];
  if (fret > 0 && !demand.notes.some((n) => n.string === s && n.fret === fret)) extra++;
}

return { covered, total: demand.notes.length, extra,
         blocked: demand.open.filter((s) => frets[s] > 0).length };
```

Three independent counts.

**`covered`** — exact string-and-fret matches. `frets[note.string] === note.fret` is strict equality on both axes: the right fret on the *wrong string* doesn't count, because it's a different pitch and a different finger.

**`extra`** — notes the grip presses that the tab never asks for. The nested `.some()` makes this O(6 × n), which is fine at these sizes. `fret > 0` excludes muted and open strings from being "extra" — a grip that mutes a string the tab ignores costs nothing.

**Why `extra` matters:** a full barre chord covers a lot of notes, but if the tab only uses three of them the player is holding down three fingers for nothing. Between two grips that cover the same notes, the sparser one is easier.

**`blocked`** — strings the tab needs open that this grip frets. `demand.open.filter(s => frets[s] > 0).length`. **This is the hard constraint** conceptually: fretting a string the tab plays open produces the *wrong note*, not merely extra effort. The sort below ranks it accordingly — above `extra`, below `covered`.

**Note `blocked` isn't a disqualifier.** A grip with `blocked > 0` still appears, just ranked lower. Arguably it should be filtered out entirely; the current design prefers offering an imperfect suggestion over offering none.

---

## `scoreShape(name, shape, demand)`

```ts
return {
  name,
  label: shapeLabel(name, shape),
  frets: [...shape.frets] as ShapeMatch["frets"],
  fingering: fingerShape(shape.frets, { barre: shape.barre }),
  ...shapeCoverage(shape.frets, demand),
};
```

An assembler. Two details worth noting:

**`[...shape.frets]`** — a **defensive copy**. `shape` comes from the memoised `chordShapeCatalog()`, which is shared module state for the app's lifetime. Handing out a reference would let any consumer mutate the catalogue. The `as ShapeMatch["frets"]` re-establishes the tuple type that spreading erases.

**`...shapeCoverage(...)` spread last** — merges the four count fields in. Since `ShapeMatch extends ShapeCoverage`, this is what satisfies the interface. Spreading last also means those four keys win any collision, though none exists.

---

## `suggestTabShapes(columns, limit = 6)` — the recommender

> *"Find the hand shapes that hold as much of a tab as possible at once — the answer to 'where do I put my hand so I barely have to move it'. A grip wins by covering more of the tab's notes; ties go to the one that asks for the fewest fingers the tab never uses, doesn't block strings the tab needs open, and sits lowest on the neck."*

### Guard

```ts
const demand = tabDemand(columns);
if (demand.notes.length === 0) return [];
```

No fretted notes ⇒ nothing to suggest. Returns `[]`, not `null` — callers can iterate unconditionally.

### Map every catalogue entry

```ts
chordShapeCatalog().map(({ name, shape }) => scoreShape(name, shape, demand))
```

Scores **every** grip the library knows (~70 entries after generation) against this tab. Brute force, and cheap because the catalogue is memoised and each score is O(36).

### The filter

```ts
.filter((m) => m.covered === m.total || (m.covered >= 2 && m.covered * 2 >= m.total))
```

> *"A grip that catches a couple of notes out of many isn't a hand position worth recommending — that tab moves, and the position list says so better. Ask for at least half the tab before offering a shape."*

**Two ways to qualify:**

1. **`m.covered === m.total`** — covers everything. Always offered, even for a one- or two-note tab where the 50% rule's `covered >= 2` floor would otherwise reject it. This clause is what makes short fragments work.

2. **`m.covered >= 2 && m.covered * 2 >= m.total`** — at least two notes, and at least half.

**`m.covered * 2 >= m.total` instead of `m.covered / m.total >= 0.5`** — integer multiplication rather than float division. Exact, no rounding questions.

**The `covered >= 2` floor** stops a single-note match from qualifying on a two-note tab (where 1 × 2 ≥ 2 would pass). One note in common isn't a hand position.

**The design point in the comment** is worth internalising: when a tab genuinely moves up the neck, *no* single grip fits, and the honest answer is "this fragment moves — here are its positions" (`tabPositions` below), not a misleading grip suggestion. The filter is what keeps the feature from lying.

### The sort — a six-key comparator

```ts
.sort((a, b) =>
  b.covered - a.covered ||        // 1. more coverage wins        (descending)
  a.blocked - b.blocked ||        // 2. fewer blocked opens        (ascending)
  a.extra - b.extra ||            // 3. fewer wasted fingers       (ascending)
  a.fingering.position - b.fingering.position ||  // 4. lower on the neck
  a.name.length - b.name.length ||                // 5. simpler name
  a.name.localeCompare(b.name)                    // 6. alphabetical
)
```

**The `||` chain is the standard multi-key comparator idiom** — each term returns `0` (falsy) on a tie, falling through to the next.

**Note the argument order encodes direction.** `b.covered - a.covered` is descending (more is better); `a.blocked - b.blocked` is ascending (less is better). Getting one backwards is a silent bug, and reading the order is the only way to check.

**Why this priority order:**

1. **`covered`** — the primary goal. A grip that holds more of the tab is more useful, full stop.
2. **`blocked`** — before `extra`, because blocking an open string produces a *wrong note*, while an extra fretted finger is merely wasted effort.
3. **`extra`** — economy of motion.
4. **`position`** — lower on the neck. Easier to reach, wider frets, more likely to be where the player already is.
5. **`name.length`** — `"Am"` before `"Am7"`. An Occam's-razor tiebreak, the same instinct as `-formulaSet.size` in [`chord-detect.ts`](chord-detect.ts.md).
6. **`localeCompare`** — alphabetical, purely so the output is **deterministic**. Without a total order, two equally-ranked grips could swap between renders depending on sort stability. The last key exists to make the result reproducible, not because alphabetical order is meaningful.

### Dedup and limit

```ts
const unique: ShapeMatch[] = [];
const seen = new Set<string>();
for (const match of matches) {
  const key = match.frets.join(",");
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(match);
  if (unique.length >= limit) break;
}
```

> *"One grip per fret layout is enough; alternate names for the same fingering would just repeat the same picture."*

**Dedup by `frets.join(",")`** — the third appearance of this key in the codebase (`chordShapeCatalog`'s `add`, and conceptually `tabDemand`'s `"string:fret"`). The catalogue already dedups by fingering, but transposed shapes can still collide here, and enharmonic names (`A#m` / `Bbm`) describe identical grips.

**Because the array is sorted first, the survivor of each duplicate group is the best-ranked one.** Dedup-after-sort is what makes that true; reversing the order would keep an arbitrary member.

**`break` on reaching `limit`** — stops as soon as enough are collected, rather than filtering the whole list and slicing. Meaningful because the loop is over a sorted array, so the first `limit` unique entries are the top `limit`.

**`limit = 6` default** — a UI decision (six diagrams fit a panel) with a sensible override.

---

## `tabPositions(columns)`

```ts
export function tabPositions(columns: readonly TabColumn[]): TabPosition[] {
  const out: TabPosition[] = [];
  for (const step of tabSteps(columns)) {
    const { position } = step.fingering;
    if (position === 0) continue;
    const last = out[out.length - 1];
    if (last && last.position === position) {
      last.toColumn = step.column;
      last.columns++;
    } else {
      out.push({ position, fromColumn: step.column, toColumn: step.column, columns: 1 });
    }
  }
  return out;
}
```

> *"Split the tab into the hand positions it actually needs, so an author can see at a glance whether a fragment stays put or drags the hand up the neck."*

**This is the complement to `suggestTabShapes`** — the answer for tabs that *don't* fit one grip.

### Run-length encoding

The whole function is a **run-length compression** of `tabSteps`' per-column anchors into contiguous spans.

**`if (position === 0) continue`** — `0` is `fingerShape`'s "nothing fretted" sentinel. Open/muted-only columns don't belong to a position and are skipped. Note the consequence: they're skipped *without breaking the run*, so a run of frets around an open-string column stays a single span. That's correct — an open string doesn't move your hand — and it depends on `tabSteps` having already handled those columns the same way.

**`const last = out[out.length - 1]`** — the run being extended. `undefined` on the first iteration, which the `last &&` guard handles.

**`if (last && last.position === position)`** — same position as the previous run ⇒ extend it: push `toColumn` forward and increment the count.

**`else`** ⇒ the hand moved. Start a new run with `fromColumn === toColumn === step.column` and `columns: 1`.

**Mutating `last` in place** rather than replacing it. Safe because `out` owns those objects exclusively — they're constructed here and never shared.

**`step.column` is the *original* column index**, preserved by `tabSteps`' map-before-filter ordering. So `fromColumn`/`toColumn` refer to positions in the author's actual tab, not in the filtered subset. That's the whole reason `tabSteps` captures the index when it does.

**`columns` is not derivable from `toColumn - fromColumn + 1`** — because skipped (unplayed) columns fall inside the span but aren't counted. `columns` is "how many sounding columns," the range is "where in the tab." Both are useful and they genuinely differ.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `fret === null \|\| fret < 0` → skip | `tabDemand` | Muted strings aren't a constraint on the grip |
| `fret === 0` → `open.add` | `tabDemand` | Open is a demand for *absence*, tracked separately |
| `seen.has("string:fret")` | `tabDemand` | A repeated note is one demand, not many |
| `.sort((a,b) => a-b)` | `tabDemand` | Default sort is lexicographic — `[2,10]` → `[10,2]` |
| `Number.isFinite(lowestFret)` | `tabDemand` | No fretted notes ⇒ `lowestFret` still `Infinity` |
| `frets.includes(0)` | `shapeLabel` | Open shapes have one position; movable ones need "(5fr)" |
| `lowest > 1` | `shapeLabel` | Don't annotate a shape already at the nut |
| `covered === total \|\| (>=2 && *2 >= total)` | `suggestTabShapes` | Full match always qualifies; otherwise half the tab, min 2 |
| six-key `\|\|` comparator | `suggestTabShapes` | Priority order; last key guarantees determinism |
| `seen.has(frets.join(","))` after sort | `suggestTabShapes` | Best-ranked member of each duplicate group survives |
| `if (unique.length >= limit) break` | `suggestTabShapes` | Sorted ⇒ first `limit` unique are the top `limit` |
| `if (position === 0) continue` | `tabPositions` | Skip unfretted columns *without* breaking the run |
| `if (last && last.position === position)` | `tabPositions` | Run-length encode consecutive same-position columns |

---

## The layer, assembled

```
tunings.ts      MIDI numbers per string
    ↓
chord-detect.ts frets + tuning → chord name
chords.ts       chord name → ChordShape;  chordShapeCatalog()
    ↓
fingering.ts    ChordShape / TabColumn → which finger, which position
    ↓
tab-shapes.ts   TabColumn[] → "play this as an Am at the 5th fret"
```

Each layer depends only on the ones above it. No cycles, no UI, no I/O — the whole music layer is pure functions over plain data, which is why it can be tested in a REPL with `npx esbuild <file> --bundle --format=esm --outfile=/tmp/x.mjs && node -e 'import("/tmp/x.mjs").then(...)'`.

---

## Related

- [`lib/music/fingering.ts`](fingering.ts.md) — `fingerShape`, `tabSteps`, `parseTabCell`
- [`lib/music/chords.ts`](chords.ts.md) — `chordShapeCatalog()`, the search space
- [`lib/types.ts`](../types.ts.md) — `TabColumn`, `TabHint` (the feature this powers)
- [`components/create/TabFingeringPanel.svelte`](../../components/create/TabFingeringPanel.svelte.md) — the UI for both functions
- [`components/notes/TabHintView.svelte`](../../components/notes/TabHintView.svelte.md) — renders the saved hint
