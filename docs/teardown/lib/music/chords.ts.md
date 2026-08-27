# `src/lib/music/chords.ts`

**Role:** The chord-shape library. Maps a chord name (`"Am"`, `"F#m7"`) to a fingering diagram, deriving unknown shapes by transposition when it can.
**Size:** 182 lines. **Depends on:** `./transpose`.

---

## `ChordShape`

```ts
export interface ChordShape {
  frets: [number, number, number, number, number, number];
  baseFret: number;
  barre?: { fret: number; from: number; to: number };
}
```

**`frets`** — the same encoding as `TabHint.frets` in [`types.ts`](../types.ts.md), same low-E-first order:

| Value | Meaning |
|---|---|
| `-1` | muted |
| `0` | open |
| `n` | fret `n`, **absolute** |

*"absolute"* is doing real work in that comment. Frets are numbered from the nut, **not** relative to `baseFret`. So a B major at `[-1,2,4,4,4,2]` with `baseFret: 2` has its lowest pressed fret at 2, and the renderer subtracts `baseFret` to place the dot in the diagram. Storing absolute frets means the numbers are directly comparable across shapes and can be shifted by plain addition — which is exactly what `shiftShape` does.

**`baseFret`** — the lowest fret the diagram draws. `1` for open-position chords; higher for barre chords up the neck, where drawing frets 1–5 to show a chord at fret 5 would waste most of the diagram. This is a **rendering hint**, not musical data.

**`barre?`** — optional. `{ fret, from, to }` with `from`/`to` as **low→high string indices**, matching `frets`. `F` is `{ fret: 1, from: 0, to: 5 }` — the index finger flattened across all six strings at fret 1. Purely for drawing the bar; the `frets` array already contains the correct fret numbers.

---

## `SHAPES` — the catalogue

```ts
const SHAPES: Record<string, ChordShape> = { C, Cmaj7, C7, ... Bb5 };
```

45 hand-entered shapes. Read the data itself — it tells you what kind of app this is:

- **Root order** C → D → E → F → G → A → B, and within each root: major, maj7, 7, m, m7, sus. That's the order a guitar method book teaches them.
- **Open-position chords dominate.** The full-barre shapes present are `F`, `Fm`, `F#m`, `Gm`, `Cm`, `B`, `Bm` — the seven you can't avoid.
- **`G/B`** is the only slash chord, because it's ubiquitous in the I–V–vi–IV progressions this app is for.

**Verify a shape by hand:** `Am: [-1, 0, 2, 2, 1, 0]` — low E muted, A open, D at 2, G at 2, B at 1, high e open. That is A minor. Doing this once for one chord confirms you've internalised the index order.

### The power-chord block

```ts
// Power chords: the open pair plus one movable grip per root string, which the
// catalog slides up the neck to cover riffs anywhere.
E5:  { frets: [ 0, 2, 2, -1, -1, -1], baseFret: 1 },
A5:  { frets: [-1, 0, 2,  2, -1, -1], baseFret: 1 },
F5:  { frets: [ 1, 3, 3, -1, -1, -1], baseFret: 1 },
Bb5: { frets: [-1, 1, 3,  3, -1, -1], baseFret: 1 },
```

Four entries that behave differently from the rest, and the comment explains why. `E5` and `A5` use open strings, so they're stuck where they are. `F5` and `Bb5` are the **movable** versions of the same two grips — no open strings, so `chordShapeCatalog()` can slide them up the neck to generate every power chord from F5 and Bb5 upward.

Two seed shapes (one rooted on the 6th string, one on the 5th) generate ~24 catalogue entries. That's the mechanism the comment refers to, and it's why only four are typed out.

---

## `shapeCache` and the memoisation

```ts
const shapeCache = new Map<string, ChordShape | null>();
```

> *"Resolved lookups, **including the misses**. A song renders one diagram per chord occurrence, so the same handful of names is resolved over and over — and an unknown name costs 495 iterations of the search below, each running a regex and building a transposed string."*

**"including the misses" is the key phrase.** The value type is `ChordShape | null`, so a failed lookup is cached too. Without that, an unrecognised name — and remember [`parse.ts`](parse.ts.md) can leak `"Breakdown"` into `Note.chords` — pays the full 495-iteration search **on every render**.

Where 495 comes from: 11 semitones × 45 shapes = 495 `transposeChord` calls in the worst case, each running a regex and allocating a string.

### Why `getChordShape` is split from `resolveChordShape`

```ts
export function getChordShape(name: string): ChordShape | null {
  const cached = shapeCache.get(name);
  if (cached !== undefined) return cached;
  const resolved = resolveChordShape(name);
  shapeCache.set(name, resolved);
  return resolved;
}
```

**`if (cached !== undefined)`, not `if (cached)`.** This is the crux, and getting it wrong would silently disable the negative caching.

`Map.get` returns `undefined` for a missing key. But a cached *miss* is stored as `null`. Since `null` is falsy, `if (cached)` would treat every cached miss as "not cached," re-run the 495-iteration search, and re-store the same `null` — forever. The strict `!== undefined` distinguishes "absent from the map" (`undefined`) from "present, value null."

This is the same falsy-trap family as `transposeNote`'s `index === undefined` guard for A=0, and `parseChordLine`'s `match[1] !== undefined`. Three instances of the same discipline in this layer.

**The two-function split** cleanly separates caching from resolution: `resolveChordShape` is a pure function that never touches the cache, and `getChordShape` is a thin memoising wrapper. Testing or reasoning about either is independent.

**Unbounded cache** — no eviction. Fine: keys are chord names, so the ceiling is however many distinct strings appear across the user's library. Bounded in practice by human authorship.

---

## `knownNamesByQuality()` — the search index

```ts
let byQuality: Map<string, string[]> | null = null;

function knownNamesByQuality(): Map<string, string[]> {
  if (byQuality) return byQuality;
  byQuality = new Map();
  for (const knownName of Object.keys(SHAPES)) {
    const km = knownName.match(/^([A-G][#b]?)(.*)$/);
    if (!km) continue;
    const list = byQuality.get(km[2]);
    if (list) list.push(knownName);
    else byQuality.set(km[2], [knownName]);
  }
  return byQuality;
}
```

> *"Known chord names grouped by quality, so the search skips the mismatches."*

**Lazy initialisation:** `if (byQuality) return byQuality` — built on first use, reused forever. Truthiness is safe here because the value is either `null` or a `Map` (always truthy). Contrast with `shapeCache`, where the value can legitimately be `null`.

**The loop** inverts `SHAPES` from name→shape into quality→names:

```
""     → ["C", "D", "E", "F", "G", "A", "B"]
"m"    → ["Cm", "Dm", "Em", "Fm", "F#m", "Gm", "Am", "Bm"]
"maj7" → ["Cmaj7", "Dmaj7", "Emaj7", "Fmaj7", "Gmaj7", "Amaj7"]
"5"    → ["E5", "A5", "F5", "Bb5"]
```

**`if (!km) continue`** — skips any key that doesn't parse as root+quality. `"G/B"` *does* parse (root `G`, quality `/B`), landing in its own single-entry group. Harmless.

**The `if (list) / else` is manual `Map` upsert.** `Map` has no `getOrCreate`, so this is the standard two-branch form. `byQuality.get(km[2]) ?? []` followed by an unconditional `set` would be shorter but reallocates and re-sets on every hit.

**Why this index exists:** without it, `resolveChordShape` searches all 45 shapes per semitone. With it, resolving `"Bbm7"` searches only the ~4 known `m7` shapes. Roughly a 10× cut on the hot path, and it also makes the search *correct by construction* — only same-quality shapes can ever match, so the inner loop can't waste time on candidates that could never produce the target.

---

## `resolveChordShape(name)` — the derivation search

```ts
function resolveChordShape(name: string): ChordShape | null {
  if (SHAPES[name]) return SHAPES[name];

  const match = name.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return null;
  const [, , quality] = match;

  const candidates = knownNamesByQuality().get(quality);
  if (!candidates) return null;

  for (let semitones = 1; semitones <= 11; semitones++) {
    for (const knownName of candidates) {
      if (transposeChord(knownName, semitones) === name) {
        return shiftShape(SHAPES[knownName], semitones);
      }
    }
  }
  return null;
}
```

> *"If the exact name isn't known, we try to derive one by transposing the nearest known shape of the same quality, so uncommon keys still render something reasonable."*

**Fast path:** `if (SHAPES[name]) return SHAPES[name]` — an exact hit, no search.

**Parse:** the same root+quality regex as `transpose.ts`, duplicated rather than imported (it's not exported there). `const [, , quality]` skips both the full match *and* the root — only the quality is needed, since the search works by asking "which known chord transposes *to* this name?"

**`if (!candidates) return null`** — no known shape of this quality at all (say `"Cm11"`), so nothing to derive from. Early exit before the loops.

### The nested search

**Outer loop: `semitones` 1 → 11.** Every possible transposition within an octave. Not 0 (that's the exact match already handled) and not 12 (a full octave is the same pitch class, and the same name — it would never produce a *different* target).

**Inner loop: each same-quality candidate.**

**The test — `transposeChord(knownName, semitones) === name`** — is the clever part, and it's worth pausing on. Rather than computing "what interval separates `Bbm` from the nearest known minor shape?", it **searches forward**: transpose every known minor chord by every offset and see which lands on the target. Brute force, but it reuses `transposeChord` — which already handles enharmonics, accidentals, and slash chords — instead of reimplementing note arithmetic.

The subtle benefit: `transposeChord` with default `preferFlat = false` always outputs sharp spellings. So a target of `"Bbm"` will **never** be matched — nothing transposes *to* `"Bb"` under sharp-preferring output; it would produce `"A#m"`. That's a genuine gap: **flat-named chords not in `SHAPES` don't resolve.** `Bb5` is in the table explicitly, which may be why.

**Why the loop order matters:** `semitones` outer, candidates inner, means the **smallest transposition wins**. The first match found is the one requiring the least shift, so the derived shape stays as close to open position as possible — the most playable option. Swapping the loops would return whichever candidate happened to come first in `SHAPES`, at an arbitrary distance up the neck. The ordering is a musical decision expressed as loop nesting.

**Return `shiftShape(SHAPES[knownName], semitones)`** — the found shape, slid up.

**Falls through to `return null`** if nothing matched. `getChordShape` caches that null.

### The correctness caveat

Sliding a shape up the neck is only valid if it has no open strings — an open string doesn't move when your hand does. `resolveChordShape` **does not check `isMovable`**. So an open shape can be selected and shifted, producing a diagram whose open strings are now wrong for the named chord.

`chordShapeCatalog()` below *does* check, and its comment explains exactly this hazard. The asymmetry is deliberate-looking: the catalogue is a browsable list where a wrong entry is a lie, whereas `getChordShape` is best-effort rendering where *something reasonable* beats nothing. The function's own doc comment hedges with *"still render something reasonable."* Worth being aware of.

---

## `isMovable(shape)`

```ts
function isMovable(shape: ChordShape): boolean {
  return !shape.frets.includes(0);
}
```

> *"A shape can slide up the neck only if it leans on no open strings."*

One line, real musical content. `0` means an open string — a fixed pitch determined by the tuning, not by hand position. Move your hand up two frets and every *fretted* note rises two semitones while every open string stays put, so the chord's intervals break.

**`includes(0)` specifically** — not `<= 0`. `-1` (muted) is fine to slide: a muted string stays muted. Only `0` disqualifies.

`E` (`[0,2,2,1,0,0]`) has three open strings — not movable. `F` (`[1,3,3,2,1,1]`) has none — movable, which is precisely why the F barre shape is the one guitarists learn to move.

---

## `chordShapeCatalog()` — generating every grip

```ts
export function chordShapeCatalog(): CatalogEntry[] {
  if (catalog) return catalog;

  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();

  const add = (name: string, shape: ChordShape) => {
    const key = shape.frets.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ name, shape });
  };

  for (const [name, shape] of Object.entries(SHAPES)) add(name, shape);

  for (const [name, shape] of Object.entries(SHAPES)) {
    if (!isMovable(shape)) continue;
    for (let semitones = 1; semitones <= 12; semitones++) {
      const shifted = shiftShape(shape, semitones);
      if (Math.max(...shifted.frets) > 15) break;
      add(transposeChord(name, semitones), shifted);
    }
  }

  catalog = entries;
  return entries;
}
```

> *"Every grip the library can offer: each known shape where it sits, plus the movable (barre) shapes repeated up the neck. Open shapes are left where they are — sliding one up would keep its open strings and stop being the chord its transposed name claims."*

Consumed by [`chord-detect.ts`](chord-detect.ts.md)'s callers and the fingering panel — the searchable list of "grips you could play."

**Memoised** in module-level `catalog`, same lazy pattern as `byQuality`.

### The `add` closure and dedup-by-shape

```ts
const key = shape.frets.join(",");
if (seen.has(key)) return;
```

**Deduplication is by fingering, not by name.** `frets.join(",")` produces `"-1,0,2,2,1,0"` — a canonical string key for the physical grip.

Why that's the right key: two different names can describe the same six fret positions. `Am` and a transposed something-else could collide. Since this catalogue answers "what can I play here," offering the same grip twice under two names is noise.

**Consequence:** the **first** name to claim a grip wins. The first loop adds all the hand-written shapes before any generated ones, so a real name like `"Am"` always beats a derived alias. The two-pass structure is what guarantees that ordering.

### Pass 1 — the base shapes

```ts
for (const [name, shape] of Object.entries(SHAPES)) add(name, shape);
```

`Object.entries` with destructuring, giving name and shape together. All 45 shapes at their written positions, unconditionally.

### Pass 2 — sliding the movable ones

```ts
if (!isMovable(shape)) continue;
```

**The guard the comment justifies.** Open shapes are skipped entirely — sliding `E` up 3 frets would produce a grip labelled `"G"` that isn't a G chord, because the three open strings didn't move.

```ts
for (let semitones = 1; semitones <= 12; semitones++) {
```

Up to a full octave. **12 here, but 11 in `resolveChordShape`** — and the difference is meaningful. There, 12 would produce a duplicate *name*. Here, the shape at +12 is a genuinely different *position* on the neck (same chord, one octave up), which is a real alternative grip worth offering.

```ts
const shifted = shiftShape(shape, semitones);
if (Math.max(...shifted.frets) > 15) break;
```

**The fretboard bound.** `Math.max(...frets)` finds the highest fret; past 15 you're in the cutaway where most acoustics can't reach and the frets are too cramped to be useful.

**`break`, not `continue`** — and this is correct rather than sloppy. Frets increase monotonically with `semitones`, so once one shift exceeds 15, every larger shift will too. `break` exits immediately; `continue` would keep testing shifts that can't possibly pass. A small, correct optimisation that depends on knowing the sequence is monotonic.

**`Math.max(...shifted.frets)`** — spread into `Math.max`. Safe with six elements; the spread-into-max idiom blows the stack on very large arrays, but not here.

```ts
add(transposeChord(name, semitones), shifted);
```

The name comes from `transposeChord` — the same function `resolveChordShape` searches with, so names stay consistent between the two mechanisms. Sharp-spelled, per the default.

---

## `shiftShape(shape, semitones)`

```ts
function shiftShape(shape: ChordShape, semitones: number): ChordShape {
  const frets = shape.frets.map((f) => f <= 0 ? f : f + semitones) as ChordShape["frets"];
  const minPressed = Math.min(...frets.filter((f) => f > 0));
  return {
    frets,
    baseFret: minPressed > 3 ? minPressed : 1,
    barre: shape.barre ? { ...shape.barre, fret: shape.barre.fret + semitones } : undefined,
  };
}
```

The transposition primitive, used by both `resolveChordShape` and `chordShapeCatalog`.

### `f <= 0 ? f : f + semitones`

**The ternary preserves both special values in one condition.** `-1` (muted) and `0` (open) are both `<= 0`, so both pass through untouched; only positive fret numbers shift.

Muted staying muted is obviously right. **Open staying open is the interesting case** — and it's exactly the bug `isMovable` exists to prevent. This function will happily shift a shape with open strings; it just leaves the `0`s alone, producing a grip that is *not* the chord its new name claims. `shiftShape` is a mechanical operation; the musical judgement lives in the caller.

**`as ChordShape["frets"]`** — `.map` on a tuple returns `number[]`, which isn't assignable to a 6-tuple. The indexed access type `ChordShape["frets"]` names the tuple type without repeating it. Sound: `map` preserves length.

### `Math.min(...frets.filter(f => f > 0))`

The lowest **pressed** fret. `filter(f => f > 0)` excludes muted (`-1`) and open (`0`) — neither is a hand position, and including `-1` would make `minPressed` always `-1`.

**Edge case:** if every string is muted or open, `filter` returns `[]` and `Math.min()` with no arguments returns **`Infinity`**. Then `Infinity > 3` is true and `baseFret` becomes `Infinity`. In practice unreachable — such a "shape" isn't a chord, and `isMovable` rejects anything with a `0` before it gets here — but it's an unguarded edge.

### `baseFret: minPressed > 3 ? minPressed : 1`

The rendering-window decision.

- **`minPressed <= 3`** → `baseFret: 1`. Draw from the nut. Open-position chords look right anchored at fret 1, and the nut is a useful visual landmark.
- **`minPressed > 3`** → `baseFret: minPressed`. Start the diagram at the chord. A chord at fret 7 drawn from fret 1 would waste six of its frets on empty space.

**Why 3 and not some other number:** a diagram typically shows 4–5 frets. With `baseFret: 1`, frets 1–5 are visible, so anything up to fret 5 fits — 3 is a conservative threshold that keeps the nut visible for anything close to open position.

### The barre

```ts
barre: shape.barre ? { ...shape.barre, fret: shape.barre.fret + semitones } : undefined
```

**Spread-then-override:** copy `from` and `to` (string indices, unaffected by moving up the neck) and replace `fret` with the shifted value. Sliding a barre changes which fret you bar, not which strings.

**The spread creates a new object**, so the original `SHAPES` entry is never mutated. Essential — `SHAPES` is a module-level constant that `chordShapeCatalog` shifts twelve times; mutating it would corrupt the source data on the first pass. The `frets` array is likewise new (from `.map`). `shiftShape` is fully non-mutating, which is what makes it safe to call repeatedly on the same input.

**`: undefined`** rather than omitting the key — required, because the object literal must satisfy `ChordShape` and a conditional key isn't expressible in a single expression. Functionally the same as absent.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `if (cached !== undefined)` | `getChordShape` | Distinguish "not cached" from "cached miss (null)" — negative caching |
| `if (byQuality)` / `if (catalog)` | two memos | Lazy one-time construction |
| `if (!km) continue` | `knownNamesByQuality` | Skip unparseable keys |
| `if (list) / else` | `knownNamesByQuality` | Manual `Map` upsert |
| `if (SHAPES[name])` | `resolveChordShape` | Exact-hit fast path |
| `for semitones` **outer**, candidates **inner** | `resolveChordShape` | Smallest shift wins ⇒ most playable shape |
| `1..11` vs `1..12` | resolve vs catalog | 12 duplicates a *name* but is a distinct *position* |
| `if (!isMovable) continue` | `chordShapeCatalog` | Open strings don't move with your hand |
| `if (max > 15) break` | `chordShapeCatalog` | Monotonic ⇒ `break` beats `continue` |
| `seen.has(frets.join(","))` | `add` | Dedupe by fingering, not by name |
| `f <= 0 ? f : f + semitones` | `shiftShape` | Preserve muted (−1) and open (0) in one test |
| `minPressed > 3 ? minPressed : 1` | `shiftShape` | Keep the nut visible near open position |

---

## Performance shape

Three layers of memoisation, each justified by a specific cost:

1. **`shapeCache`** — per-name, including misses. Avoids a 495-iteration search per render.
2. **`byQuality`** — built once. Cuts the search ~10×.
3. **`catalog`** — built once. ~45 + ~24 generated entries.

All module-level, so they persist for the app's lifetime and are shared across every component. None are bounded, which is fine given the inputs are chord names and a fixed shape table.

---

## Related

- [`lib/music/transpose.ts`](transpose.ts.md) — `transposeChord`, used as the search oracle
- [`lib/music/chord-detect.ts`](chord-detect.ts.md) — the inverse problem: frets → name
- [`lib/types.ts`](../types.ts.md) — `TabHint.frets` shares this fret encoding
- [`components/notes/ChordDiagram.svelte`](../../components/notes/ChordDiagram.svelte.md) — renders `ChordShape`, consumes `baseFret` and `barre`
- [`components/create/TabFingeringPanel.svelte`](../../components/create/TabFingeringPanel.svelte.md) — browses `chordShapeCatalog()`
