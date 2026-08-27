# `src/lib/music/chord-detect.ts`

**Role:** The inverse of [`chords.ts`](chords.ts.md) — given six fret positions and a tuning, work out what chord is being played.
**Size:** 160 lines. **Depends on:** `./tunings` (type only).

The most algorithmically substantial file in the codebase. It's a **scored search** over 12 roots × 14 qualities × up to 64 mute/open combinations, with the scoring weights encoding real guitar practice.

---

## `NOTE_NAMES`

```ts
const NOTE_NAMES = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"] as const;
```

Twelve pitch classes, **indexed from C = 0** — the MIDI convention, so `midi % 12` indexes directly into this array with no offset arithmetic.

**Note this differs from [`transpose.ts`](transpose.ts.md), which indexes from A = 0.** Two files, two origins, and nothing connects them. The reason is that this file works from MIDI numbers (where C is the natural zero) and `transpose.ts` works from note names (where A is a conventional start). It's a real inconsistency and a place to be careful when moving between them.

**The spelling is deliberately mixed** — sharps for `C#`, `F#`; flats for `Eb`, `Ab`, `Bb`. Not arbitrary: these are the spellings guitarists actually use for those pitches. Nobody writes "D#m" for the chord at that pitch; they write "Ebm". `transpose.ts` solves the enharmonic problem with two full scales and a `preferFlat` flag; here a single hand-picked spelling per pitch was judged good enough, because detection output is a suggestion the user can override.

---

## `QUALITIES`

```ts
// Ordered so that, on a tie, earlier (simpler) qualities win.
const QUALITIES: [string, number[]][] = [
  ["",     [0, 4, 7]],        // major
  ["m",    [0, 3, 7]],        // minor
  ["7",    [0, 4, 7, 10]],    // dominant 7
  ["maj7", [0, 4, 7, 11]],
  ["m7",   [0, 3, 7, 10]],
  ["sus2", [0, 2, 7]],
  ["sus4", [0, 5, 7]],
  ["dim",  [0, 3, 6]],
  ["aug",  [0, 4, 8]],
  ["add9", [0, 2, 4, 7]],
  ["6",    [0, 4, 7, 9]],
  ["m6",   [0, 3, 7, 9]],
  ["9",    [0, 2, 4, 7, 10]],
  ["5",    [0, 7]],           // power chord
];
```

**Chord formulas as semitone intervals from the root.** `[0, 4, 7]` = root, major third (4 semitones), perfect fifth (7) = a major triad. `[0, 3, 7]` swaps the major third for a minor third. This is standard music theory encoded as integer offsets, which is what makes the whole algorithm arithmetic rather than symbolic.

**An array of tuples, not a `Record`** — because **order is a tiebreaker**, as the comment states. The scoring loop uses strict `>` when comparing, so the first quality to achieve a given score keeps it. Since simpler qualities come first, an ambiguous fingering resolves to the simpler name: `C` rather than `Cmaj7` if both fit equally.

That's the right default. A player who fingers a plain major triad wants to see "C", not a more exotic name that happens to score the same.

**`5` is last** despite being the simplest formula. Deliberate: a power chord is only two notes and matches a subset of nearly every other chord, so putting it first would make everything a power chord. Its late position, plus the separate `played.size < 3` handling below, keeps it as a fallback.

---

## `UNSET_FRET`

```ts
/** A string whose state the player hasn't decided yet — guessed open or muted. */
export const UNSET_FRET = -2;
```

**A third state beyond muted (`-1`) and open (`0`)**, and the reason this file is more than a lookup.

The UX problem it solves: a player using the fretboard input clicks the three notes of Em — frets on strings 5 and 4 — and expects the app to say "Em." But what about the other three strings? Requiring the player to explicitly mark each one open would be tedious and would defeat the point of a quick visual input.

`UNSET_FRET` means "I haven't said." The detector then **tries every combination** of open/muted for those strings and picks whichever yields the best chord. See `detectChord`.

`-2` is chosen to stay below `-1` so `f < 0` still means "not sounding" in `scoreFrets` — the existing muted check covers it without modification.

---

## `scoreFrets(frets, tuning)` — the scoring core

Takes a **fully resolved** fingering (no `UNSET_FRET` remaining) and scores it against every root×quality pair.

### Step 1 — fingering to pitch classes

```ts
const played = new Set<number>();
let lowestMidi = Infinity;
let bassPc = -1;

for (let s = 0; s < 6; s++) {
  if (frets[s] < 0) continue;
  const midi = tuning.midi[s] + frets[s];
  played.add(midi % 12);
  if (midi < lowestMidi) {
    lowestMidi = midi;
    bassPc = midi % 12;
  }
}
```

**`if (frets[s] < 0) continue`** — skips muted (`-1`) and, by construction, would skip `UNSET_FRET` (`-2`) too. One comparison covers both.

**`tuning.midi[s] + frets[s]`** — the entire fretboard model, as described in [`tunings.ts`](tunings.ts.md). String's open pitch plus fret number = absolute pitch. This is why tunings store MIDI numbers.

**`played.add(midi % 12)`** — reduces to **pitch class**, discarding octave. A chord is defined by which notes are present, not where. A `Set` so duplicates collapse — a G played on two strings contributes one member. `played.size` then means "how many distinct notes."

**Tracking the bass separately:** `lowestMidi` is compared **before** the modulo, so it finds the genuinely lowest-sounding string, not the lowest pitch class. That distinction matters — a C on the 5th string and a C an octave up have the same pitch class but different roles.

**Why the bass matters:** a chord with its root in the bass is in *root position*; with a different chord tone in the bass it's an *inversion*, conventionally written as a slash chord. The scoring below rewards root-in-bass by +10, so `C/E` and `C` are distinguished by which string is lowest.

**The loop must be indexed** (`for (let s = 0; s < 6; s++)`) rather than `for...of`, because it needs `s` to index into `tuning.midi` in parallel with `frets`.

### Step 2 — the fewer-than-three-notes branch

```ts
if (played.size < 3) {
  if (played.size === 2) {
    for (let root = 0; root < 12; root++) {
      if (played.has(root) && played.has((root + 7) % 12)) {
        return { name: NOTE_NAMES[root === bassPc ? root : bassPc] + "5", score: -10 };
      }
    }
  }
  return { name: null, score: -Infinity };
}
```

> *"Two notes can only ever be a power chord; require a real triad+."*

**The outer `if` is a guard**, not the power-chord test. Fewer than three distinct pitch classes can't form a triad, so the main scoring loop below would either find nothing or match something absurd.

**The inner `played.size === 2` check** handles the one meaningful two-note case: root plus perfect fifth = a power chord.

**The search loop:** for each candidate root, is the root present *and* the note 7 semitones above it? `(root + 7) % 12` wraps the fifth into pitch-class space. Whichever root satisfies both wins.

**`NOTE_NAMES[root === bassPc ? root : bassPc]`** — a subtle bit of naming logic. Two notes a fifth apart are ambiguous: `{C, G}` is C5 with C in the bass, or (arguably) G-something with G in the bass. **The bass note decides.** If the found `root` is what's in the bass, use it; otherwise name the chord after whatever *is* in the bass. Guitarists name a power chord by its lowest note.

**`score: -10`** — a fixed, deliberately poor score. The comment explains:
> *"Ranked below any real triad+ match so a guessable full chord always wins over settling for the bare two notes."*

This matters for `detectChord`'s combination search: if leaving a string open produces a full triad scoring higher than −10, that interpretation wins over the two-note reading. The power chord is a floor, not a competitor.

**`return { name: null, score: -Infinity }`** — the "nothing fits" sentinel. `-Infinity` guarantees it loses every comparison in `detectChord`'s `score > bestScore` test, with no special-casing needed.

**A gap worth noting:** `played.size === 1` (a single note, or unison across strings) returns null. Reasonable — one note isn't a chord.

### Step 3 — the main scoring loop

```ts
for (let root = 0; root < 12; root++) {
  for (const [quality, intervals] of QUALITIES) {
    const formula = intervals.map((i) => (root + i) % 12);
    const formulaSet = new Set(formula);
    ...
  }
}
```

**168 iterations** (12 × 14) per call. Brute force over every chord the app knows, in every key.

**`(root + i) % 12`** — transposes the interval formula to this root, wrapping in pitch-class space. `["m", [0,3,7]]` at root 9 (A) → `{9, 0, 4}` = A, C, E. Correct: A minor.

#### The optional fifth

```ts
const hasThird = intervals.includes(3) || intervals.includes(4);
const required = intervals
  .filter((i) => !(hasThird && i === 7))
  .map((i) => (root + i) % 12);
```

> *"Guitarists routinely drop the perfect 5th, so treat it as optional for any chord that has a 3rd (power chords keep the 5th mandatory)."*

**Real musical knowledge encoded as a filter.** The fifth is the least informative note in a chord — it doesn't distinguish major from minor, and on guitar it's frequently omitted to free a finger or avoid a muddy voicing. Requiring it would make the detector reject perfectly ordinary voicings.

**`hasThird`** — does the formula contain a minor third (3) or major third (4)? If so, the third carries the chord's identity and the fifth is expendable.

**`!(hasThird && i === 7)`** — drop interval 7 *only* when a third is present. So:
- `["", [0,4,7]]` → required `[0, 4]`. The fifth is optional.
- `["5", [0,7]]` → no third, so 7 stays required. A power chord without its fifth is just a note.
- `["dim", [0,3,6]]` → has a third; interval 6 is a *diminished* fifth, not 7, so it stays required. Correct — the flat fifth is what makes it diminished.

**The `.filter().map()` order matters:** filtering on the raw interval (`i === 7`) before transposing. Filtering after would require comparing against `(root + 7) % 12`, which is more error-prone.

#### Matching and scoring

```ts
const allPresent = required.every((n) => played.has(n));
if (!allPresent) continue;

let extra = 0;
for (const pc of played) if (!formulaSet.has(pc)) extra++;

const score = -extra * 20 - formulaSet.size + (root === bassPc ? 10 : 0);

if (score > bestScore) {
  bestScore = score;
  bestName = NOTE_NAMES[root] + quality;
}
```

**`required.every(...)` — a hard gate.** Every required tone must be sounding. `continue` skips non-matches before any scoring work.

**`extra`** counts notes the player sounds that the formula doesn't name. Note it's tested against `formulaSet` (the *full* formula including the optional fifth), not `required` — so playing the fifth isn't penalised as "extra." Getting this wrong would punish complete voicings.

**The score formula — three terms, and the weights are the design:**

```
-extra * 20          heavily punish notes the chord doesn't explain
-formulaSet.size     mildly punish complexity
+10 if root is bass  strongly reward root position
```

- **`-extra * 20`** dominates. One unexplained note costs 20, which no other term can recover. Rationale: a chord name that doesn't account for what you're playing is simply wrong. This is what stops `C` from matching a fingering that's really `Cmaj7` — the B would be an extra.

- **`-formulaSet.size`** is an Occam's-razor term, worth 1 per note. Among chords that explain the notes equally well, prefer the simpler formula. Small enough never to override the extras term, large enough to break ties. Combined with `QUALITIES` order, it makes the detector biased toward common names.

- **`+10` for root in bass** sits between the two in magnitude — strong enough to pick the root-position interpretation among equal candidates, but not strong enough to outweigh a single extra note. Musically right: an inversion is still the same chord.

**`if (score > bestScore)` — strict `>`.** This is the tiebreaker mechanism. On an exact tie the incumbent keeps its place, and because the loops iterate roots ascending and `QUALITIES` in curated order, **the first-listed quality wins**. That's the behaviour the `QUALITIES` comment promises, implemented entirely by the choice of `>` over `>=`. Changing that one character would silently invert the preference for simple names.

**`NOTE_NAMES[root] + quality`** — string concatenation. `NOTE_NAMES[0] + ""` = `"C"`; `NOTE_NAMES[9] + "m"` = `"Am"`. The empty-string quality for major is why plain triads come out unadorned.

---

## `detectChord(frets, tuning)` — the combination search

```ts
export function detectChord(frets: Frets, tuning: Tuning): string | null {
  if (!frets.some((f) => f > 0)) return null;
  ...
}
```

> *"Strings left at `UNSET_FRET` aren't assumed muted: every open/muted combination for them is tried, and whichever combination produces the best-scoring chord wins — so fretting just the notes of Em (022000, with the open strings left untouched) is enough to guess 'Em' without the player also having to mark every open string by hand. Ties prefer guessing fewer strings open."*

### The early exit

```ts
if (!frets.some((f) => f > 0)) return null;
```

**`f > 0` means "actually fretted."** If nothing is pressed anywhere, there's nothing to detect — the user has an empty fretboard, or has only marked strings muted. Returning `null` avoids running 64 combinations to discover that the open strings happen to spell E minor, which would be a confusing thing to show someone who hasn't fretted anything.

Note this means a chord made **entirely of open strings** can't be detected. Correct for the UI: an untouched fretboard shouldn't announce a chord.

### Collecting unset strings

```ts
const unsetIdx: number[] = [];
frets.forEach((f, i) => {
  if (f === UNSET_FRET) unsetIdx.push(i);
});

if (unsetIdx.length === 0) {
  return scoreFrets(frets, tuning).name;
}
```

**`forEach` with index** to collect positions, not values — the indices are what the bitmask below manipulates.

**The `length === 0` fast path:** a fully-specified fingering needs no search. One `scoreFrets` call. This is the path taken when the user has explicitly marked every string, and it's also what makes the function cheap for programmatically-built fingerings.

### The bitmask enumeration

```ts
const combos = 1 << unsetIdx.length;
for (let mask = 0; mask < combos; mask++) {
  const resolved = [...frets] as Frets;
  let guesses = 0;
  unsetIdx.forEach((idx, bit) => {
    const open = (mask & (1 << bit)) !== 0;
    resolved[idx] = open ? 0 : -1;
    if (open) guesses++;
  });
  ...
}
```

**Classic subset enumeration.** Each unset string is independently open or muted — 2 choices — so `n` unset strings give `2^n` combinations.

**`1 << unsetIdx.length`** — bit shift as a fast `Math.pow(2, n)`. With all six strings unset: `1 << 6 = 64` combinations, each running `scoreFrets`'s 168 iterations ≈ **10,752 inner iterations**. That's the worst case, and it's why the early exit above matters. In practice a chord has 2–4 fretted strings, so `n` is 2–4 and it's 4–16 combinations.

**`(mask & (1 << bit)) !== 0`** — test bit number `bit` of `mask`. `1 << bit` builds a mask with only that bit set; `&` isolates it; `!== 0` converts to boolean. The `forEach`'s second parameter (`bit`) is the *position within `unsetIdx`*, not the string index — so bit 0 always corresponds to `unsetIdx[0]` regardless of which string that is. That indirection is what lets a 6-bit counter enumerate an arbitrary subset.

**`resolved[idx] = open ? 0 : -1`** — bit set ⇒ open, bit clear ⇒ muted. Writing into a **fresh copy** (`[...frets]`) each iteration, so combinations don't contaminate each other.

**`guesses` counts how many strings this combination assumes are open** — used as a tiebreaker below.

### Choosing the winner

```ts
const { name, score } = scoreFrets(resolved, tuning);
if (name === null) continue;
if (score > bestScore || (score === bestScore && guesses < bestGuesses)) {
  bestScore = score;
  bestGuesses = guesses;
  bestName = name;
}
```

**`if (name === null) continue`** — this combination didn't form a chord. Note it's `name === null`, not `!name`: an empty-string name isn't possible here, but the strict check is consistent with the file's style.

**The compound condition is a two-level comparison:**

1. **`score > bestScore`** — a strictly better chord wins outright.
2. **`score === bestScore && guesses < bestGuesses`** — on a tie, **prefer fewer strings guessed open**.

> *"Ties prefer guessing fewer strings open."*

**Why that's the right tiebreaker:** guessing a string open is an assumption about something the player didn't say. Two interpretations that fit equally well should resolve to the one that assumes less. It also produces a bias toward tighter, more likely voicings rather than ones that ring extra strings the player may not want.

`bestGuesses` starts at `Infinity`, so the first successful combination always wins its comparison. Same sentinel trick as `bestScore = -Infinity`.

**Returns `bestName`**, which stays `null` if no combination produced a chord.

---

## Complexity

| Case | Combinations | Inner iterations |
|---|---|---|
| Fully specified | 1 (fast path) | 168 |
| 2 unset strings | 4 | 672 |
| 4 unset strings | 16 | 2,688 |
| 6 unset strings | 64 | 10,752 |

**There is no memoisation here**, unlike [`chords.ts`](chords.ts.md)'s three caches. That's defensible — this runs on user interaction (tapping the fretboard), not on every render of every chord in a song, and the input space is large and rarely repeated. But it is the one hot path in the music layer without a cache, and the worst case is reached whenever the user frets one note and leaves the rest unset.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `if (frets[s] < 0) continue` | Step 1 | One test covers muted (−1) and unset (−2) |
| `midi < lowestMidi` before `% 12` | Step 1 | Bass is the lowest *pitch*, not pitch class |
| `if (played.size < 3)` | Step 2 | Fewer than 3 notes can't be a triad |
| `if (played.size === 2)` + fifth search | Step 2 | Power chord, scored −10 so triads always win |
| `hasThird && i === 7` filter | Step 3 | Guitarists drop the 5th; power chords can't |
| `required.every(...)` + `continue` | Step 3 | Hard gate before scoring |
| `-extra*20 - size + (bass?10:0)` | Step 3 | The three weights *are* the musical judgement |
| `score > bestScore` (strict) | Step 3 | Ties → earlier, simpler quality wins |
| `if (!frets.some(f => f > 0))` | `detectChord` | Nothing fretted ⇒ nothing to detect |
| `if (unsetIdx.length === 0)` | `detectChord` | Fast path, no search needed |
| `mask < (1 << n)` bit enumeration | `detectChord` | Every open/muted assignment for unset strings |
| `score === best && guesses < bestGuesses` | `detectChord` | Assume as little as possible |

---

## Suggested experiments

1. Change `score > bestScore` to `>=` in `scoreFrets` and watch simple chords start reporting exotic names.
2. Remove the `hasThird && i === 7` filter and try a fifth-less voicing — detection should start failing on ordinary shapes.
3. Set the `+10` bass bonus to `0` and see inversions get named after the wrong root.
4. Change `-extra * 20` to `-extra` and watch it match almost anything.

---

## Related

- [`lib/music/chords.ts`](chords.ts.md) — the forward direction: name → shape
- [`lib/music/tunings.ts`](tunings.ts.md) — `tuning.midi[s] + fret` is the whole fretboard model
- [`lib/music/fingering.ts`](fingering.ts.md) — assigns actual fingers to a detected shape
- [`components/create/FretboardInput.svelte`](../../components/create/FretboardInput.svelte.md) — where `UNSET_FRET` originates
- [`lib/types.ts`](../types.ts.md) — `TabHint.frets` uses the same encoding minus `UNSET_FRET`
