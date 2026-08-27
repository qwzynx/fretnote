# `src/lib/music/parse.ts`

**Role:** Turns a chord sheet's plain text into structured lines and segments so chords and strum marks can be positioned above the right syllable.
**Size:** 126 lines. **Depends on:** `@/lib/strumming` (type only).

This is the app's **notation parser** — the bridge between what the user types and what gets rendered. Everything in `ChordLyricsView.svelte` is downstream of it.

---

## The notation being parsed

```
[Verse 1]
[Am]Today is [C]gonna be the [D]day
{D}{D}{U}strum along here
[tab: Solo]
```

Four line kinds, distinguished entirely by shape:

| Line | Kind | Rule |
|---|---|---|
| `[Verse 1]` | section header | the whole line is one bracket, and the label has a space or is a known structural word |
| `[Am]Today...` | lyric | brackets appear inline with text |
| `[tab: Solo]` | tab reference | the whole line is `[tab: Name]` |
| *(empty)* | blank | nothing but whitespace |

The ambiguity this file exists to resolve: **`[Am]` and `[Bridge]` are the same shape.** One is a chord, one is a section header. Disambiguating them is most of the file's complexity.

---

## `ChordSegment`

```ts
export interface ChordSegment {
  chord: string | null;
  strum: StrokeType | null;
  text: string;
}
```

**The core rendering unit: one marker plus the text that follows it.** `"[Am]Today is "` becomes `{ chord: "Am", strum: null, text: "Today is " }`, which a component draws as "Am" positioned above "Today is ".

> *"Mutually exclusive with `chord`."*

Both fields are nullable and at most one is set — three valid states: a chord segment, a strum segment, or plain text with neither. **The type doesn't enforce the exclusivity** (`{chord: "Am", strum: "D"}` compiles); it's a convention held by the constructing code below. A discriminated union would enforce it at the cost of a more awkward shape for consumers, who mostly ask "is there a chord here?"

**`text` may be empty** — two adjacent markers (`"[Am][C]"`) produce a segment with no lyric under it. Renderers must handle a chord with nothing beneath.

---

## `ParsedLine`

```ts
export type ParsedLine =
  | { kind: "lyric"; segments: ChordSegment[] }
  | { kind: "section"; label: string }
  | { kind: "tabref"; name: string }
  | { kind: "blank" };
```

**A proper discriminated union** — unlike `Note` in `types.ts`, this one is modelled correctly. `kind` is the discriminant, so a `switch (line.kind)` in a Svelte template narrows each branch to exactly the fields it has. `{ kind: "blank" }` carries no payload at all, which the union expresses naturally.

Contrast this with `Note`'s flat optional fields and you can see both patterns in one codebase, each chosen for its situation: `Note` is flat because it maps to a flat SQL row; `ParsedLine` is a union because it's purely in-memory and consumers must branch.

---

## The regexes

```ts
const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/;
const TABREF_RE  = /^\s*\[\s*tab:\s*([^\]]+?)\s*\]\s*$/i;
const INLINE_CHORD_RE  = /\[([^\]]+)\]/g;
const INLINE_MARKER_RE = /\[([^\]]+)\]|\{([DUduX])\}/g;
```

**`SECTION_RE`** — `^\s*` … `\s*$` anchors mean *the entire line* is one bracketed token (surrounding whitespace allowed). `[^\]]+` is a negated class, so it stops at the first `]` without needing a lazy quantifier. No `/g` — it's used with `.match()` for a single test.

**`TABREF_RE`** — same anchoring, but requires the literal `tab:` prefix. The `\s*` around `tab:` and the label tolerate `[tab: Solo]`, `[tab:Solo]`, `[ tab : Solo ]`. **`+?` is lazy** here, which combined with the trailing `\s*` means trailing spaces inside the bracket land in the `\s*` rather than the capture — so `[tab: Solo ]` yields `"Solo"`, not `"Solo "`. (There's a `.trim()` at the call site anyway; belt and braces.) The **`/i` flag** allows `[TAB: Solo]`.

**`INLINE_MARKER_RE`** — an **alternation with two capture groups**, and the numbering matters:

```
\[([^\]]+)\]   → group 1 = chord
|
\{([DUduX])\}  → group 2 = strum
```

Only one group is ever set per match; the other is `undefined`. That's exactly what the parser tests (`if (match[1] !== undefined)`) to tell a chord marker from a strum marker in a single pass. One regex, one loop, two token types — rather than two passes that would then need merging by position.

`[DUduX]` is an explicit character class listing the five stroke codes, **case-sensitively** (`D` ≠ `d`). It deliberately excludes `""` (rest), which has no inline syntax — a rest is just the absence of a marker.

**`INLINE_CHORD_RE`** — chords only, used by `extractChords` where strum marks are irrelevant.

### The `/g` statefulness hazard

Both `/g` regexes are **module-level constants**, and a `/g` regex carries mutable `lastIndex` state across `.exec()` calls. That's what makes `while ((m = re.exec(s)))` work — but it also means a leftover `lastIndex` from a previous call would make the next call start mid-string.

Hence:

```ts
INLINE_MARKER_RE.lastIndex = 0;   // parseChordLine
INLINE_CHORD_RE.lastIndex  = 0;   // extractChords
```

**These resets are mandatory, not defensive.** Without them, an early `return` or `continue` out of an exec loop leaves `lastIndex` mid-string and the *next* line silently parses wrong. It's one of the classic JavaScript regex footguns, and the reason some codebases construct the regex fresh inside the function instead. Here the constant is reused and reset — cheaper, but requires this discipline at every call site.

---

## `NON_CHORD_LABELS` and `isNonChordLabel()`

```ts
const NON_CHORD_LABELS = new Set([
  "verse", "chorus", "refrain", "pre-chorus", "pre chorus",
  "bridge", "intro", "outro", "hook", "post-chorus", "post chorus",
  "rhyme schemes", "repetition", "metaphors", "similes",
  "vocalizations", "ad-libs", "storytelling", "imagery",
]);

function isNonChordLabel(s: string): boolean {
  const lower = s.trim().toLowerCase();
  if (NON_CHORD_LABELS.has(lower)) return true;
  return /^(verse|chorus|refrain|pre-?chorus|bridge|intro|outro|hook|post-?chorus)\s*\d*$/i
    .test(s.trim());
}
```

**The disambiguation heuristic.** `[Bridge]` looks exactly like a chord — `B` is a valid root, `ridge` is a valid opaque quality (see [`transpose.ts`](transpose.ts.md)). Something has to decide, and there's no clean rule, so this is a curated list.

**A `Set`, not an array** — O(1) `has()` instead of O(n) scan. It's called once per bracket per line during parsing, so it's genuinely on a hot path.

**Two-tier matching:**
1. `Set.has(lower)` — exact match on a known label. Fast path.
2. A regex allowing an optional trailing number — `"Verse 1"`, `"Chorus2"`, `"Bridge 3"`.

The second tier exists because songs number their sections. `\s*\d*` makes both the space and the digits optional, so it also re-matches the bare words — the Set is a fast path, not a disjoint case.

**`pre-?chorus`** in the regex handles `"prechorus"` and `"pre-chorus"`; the Set separately carries `"pre chorus"` (space). Three spellings, two mechanisms — slightly redundant, but the Set can hold spaces that would complicate the regex.

**The second half of the list is unusual:** `"rhyme schemes"`, `"metaphors"`, `"similes"`, `"storytelling"`, `"imagery"`. Those aren't song sections — they're **literary-analysis headings**. Their presence tells you something about how the app is actually used: people paste in annotated lyrics from analysis sites, and those brackets were rendering as chord diagrams. This list is a bug report preserved as data.

**The inherent limitation:** it's a fixed list. `[Solo]` (S — safe by luck, not by the list), `[Instrumental]` (I — safe), `[Breakdown]` (B — **not safe**) all depend on whether their first letter happens to be A–G. See the bug below.

---

## `parseChordLine(line)` — the main parser

Four phases, in priority order. The ordering is the specification.

### Phase 1 — blank

```ts
if (line.trim() === "") return { kind: "blank" };
```

Checked first because it's cheapest and unambiguous. `.trim()` means a whitespace-only line counts as blank. Blank lines are preserved as a kind (rather than dropped) because they're meaningful vertical spacing in a chord sheet.

### Phase 2 — tab reference

```ts
const tabref = line.match(TABREF_RE);
if (tabref) return { kind: "tabref", name: tabref[1].trim() };
```

**Checked before sections**, and the order is required: `[tab: Solo]` also satisfies `SECTION_RE` (it's a whole-line bracket, and it contains a space). Testing sections first would classify every tab reference as a section header. **Most specific pattern first** is the rule.

### Phase 3 — section header

```ts
const section = line.match(SECTION_RE);
if (section && (/\s/.test(section[1]) || isNonChordLabel(section[1]))) {
  return { kind: "section", label: section[1].trim() };
}
```

**The compound condition is the heart of the disambiguation.** A whole-line bracket is a section header if **either**:

**(a) `/\s/.test(section[1])` — the label contains whitespace.** Chord symbols never contain spaces (`Am7`, `F#sus4`, `C/G`). So any space is proof it isn't a chord. This one cheap test catches `"Verse 1"`, `"Guitar Solo"`, `"Chorus (x2)"` — anything multi-word, without needing to be on a list.

**(b) `isNonChordLabel(...)` — it's a known structural word.** Catches the single-word cases the space test misses: `[Bridge]`, `[Chorus]`, `[Intro]`.

**The fallthrough is deliberate.** A whole-line bracket that is neither — `[Am]` alone on a line — is *not* a section. It falls through to Phase 4 and parses as a chord with empty lyrics. Correct: a bare chord line above a repeated section is normal notation.

**Note the `&&` short-circuit ordering:** `section &&` guards the `section[1]` accesses, and `/\s/.test()` runs before the more expensive `isNonChordLabel()`.

### Phase 4 — inline markers

The real parsing loop.

```ts
const segments: ChordSegment[] = [];
let lastIndex = 0;
let leading = "";
let match: RegExpExecArray | null;

INLINE_MARKER_RE.lastIndex = 0;
while ((match = INLINE_MARKER_RE.exec(line)) !== null) {
```

**`while ((match = re.exec(line)) !== null)`** — assignment inside the condition, the standard idiom for iterating all matches of a `/g` regex with access to `.index`. Each `exec` resumes from `lastIndex` and returns `null` when exhausted. The explicit `!== null` (rather than relying on truthiness) is clearer and avoids any question about an empty-string match.

`.matchAll()` would be the modern alternative; `exec` is used here presumably because the loop body needs `lastIndex` bookkeeping anyway.

#### Attaching the text before each marker

```ts
const before = line.slice(lastIndex, match.index);
if (segments.length === 0 && before) {
  leading = before;
} else if (before) {
  segments[segments.length - 1].text += before;
}
```

`before` is the text between the end of the previous marker and the start of this one.

**Three cases, and the asymmetry is the point:**

- **`segments.length === 0 && before`** — text before the *first* marker. This text has **no chord above it**, so it can't be appended to a previous segment (there isn't one). It's stashed in `leading` and prepended at the very end. This is the `"Today is "` in `"Today is [Am]gonna be"`.
- **`else if (before)`** — normal case: the text belongs under the **previous** marker. `segments[segments.length - 1]` is the last segment pushed; `+=` appends. This is why segments are "marker plus following text" rather than "text plus following marker" — the text is attached retroactively, one iteration late.
- **`before` empty** — two adjacent markers. Nothing to attach.

The `&& before` / `else if (before)` structure means an empty `before` falls through both branches silently.

#### Pushing the marker

```ts
if (match[1] !== undefined) {
  segments.push({ chord: match[1].trim(), strum: null, text: "" });
} else {
  segments.push({ chord: null, strum: match[2] as StrokeType, text: "" });
}
lastIndex = match.index + match[0].length;
```

**`match[1] !== undefined`** — the alternation test described above. Group 1 set ⇒ chord; otherwise group 2 ⇒ strum. **`!== undefined` rather than truthiness** matters: a marker like `[ ]` could produce a group that trims to `""`, which is falsy but *is* a chord marker.

**`text: ""`** — every segment starts with empty text, filled in by the *next* iteration (or by the trailing handler).

**`match[2] as StrokeType`** — an unchecked cast, but sound: the regex class `[DUduX]` can only produce those five characters, all of which are `StrokeType` members. The compiler just can't see that a regex constrains the string.

**`lastIndex = match.index + match[0].length`** — advance past the whole marker (`match[0]` includes the brackets/braces). This is the parser's own cursor, distinct from the regex's internal `lastIndex`; they happen to track together but the code doesn't rely on that.

#### Trailing text and assembly

```ts
const trailing = line.slice(lastIndex);
if (segments.length === 0) {
  return { kind: "lyric", segments: [{ chord: null, strum: null, text: line }] };
}
if (trailing) segments[segments.length - 1].text += trailing;

const result: ChordSegment[] = [];
if (leading) result.push({ chord: null, strum: null, text: leading });
result.push(...segments);
return { kind: "lyric", segments: result };
```

**`if (segments.length === 0)`** — no markers at all: a pure lyric line. Returns a single segment holding the **whole original `line`** (not `trailing`, though they'd be equal here). An early return that skips the assembly below.

**`if (trailing)`** — text after the last marker, appended to the final segment. Same retroactive attachment as inside the loop.

**The `leading` prepend** — the stashed pre-first-marker text becomes its own chord-less segment at position 0. Building a fresh `result` array rather than `segments.unshift(...)` avoids an O(n) reindex, though at these sizes that's stylistic.

**`result.push(...segments)`** — spread rather than `concat`, mutating `result` in place.

---

## `parseChordSheet(sheet)`

```ts
export function parseChordSheet(sheet: string): ParsedLine[] {
  return sheet.replace(/\r\n/g, "\n").split("\n").map(parseChordLine);
}
```

Three chained operations.

**`.replace(/\r\n/g, "\n")`** — **line-ending normalisation, and it's essential.** Text pasted from Windows, or from many websites, uses CRLF. Splitting on `"\n"` without this leaves a trailing `\r` on every line, which would: break `SECTION_RE`'s `\s*$`… actually `\r` *is* `\s`, so sections survive; but it would append an invisible `\r` to every lyric segment's text and to every extracted chord name. `[Am]\r` → chord `"Am"` after trim, but `[Am]hi\r` → text `"hi\r"`. Subtle rendering corruption.

Note it doesn't handle bare `\r` (classic Mac). Not a real concern in 2026.

**`.map(parseChordLine)`** — passing the function reference directly. Safe here because `parseChordLine` takes one argument; `map` also passes index and array, which a two-parameter function would silently receive. A known JS hazard (`["1","2"].map(parseInt)`), avoided by the signature.

**Every line is parsed, including blanks** — the output array is 1:1 with input lines, so line numbers are preserved.

---

## `extractChords(sheet)`

```ts
export function extractChords(sheet: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  INLINE_CHORD_RE.lastIndex = 0;
  while ((match = INLINE_CHORD_RE.exec(sheet)) !== null) {
    const chord = match[1].trim();
    if (/\s/.test(chord) || /^tab:/i.test(chord) || isNonChordLabel(chord)) continue;
    if (!seen.has(chord)) {
      seen.add(chord);
      out.push(chord);
    }
  }
  return out;
}
```

> *"Collect the unique chord names used across a chord sheet, in order."*

**This populates `Note.chords`** — the denormalised column that lets the feed render chord chips without loading lyrics (see [`types.ts`](../types.ts.md)).

### The Set-plus-array pattern

Two structures for one job:
- **`seen`** — O(1) duplicate detection.
- **`out`** — preserves **first-appearance order**.

`[...new Set(allChords)]` would be shorter and, in modern JS, actually preserves insertion order too. The explicit pair is more obviously correct and doesn't rely on Set iteration-order guarantees. Order matters because the chord chips read best in the order the song introduces them.

### The three-way filter

```ts
if (/\s/.test(chord) || /^tab:/i.test(chord) || isNonChordLabel(chord)) continue;
```

Same disambiguation logic as Phase 3, plus a tab-reference check, applied per-bracket rather than per-line:

1. **`/\s/`** — contains a space ⇒ not a chord.
2. **`/^tab:/i`** — a tab reference.
3. **`isNonChordLabel`** — a known structural word.

**`continue` skips**, so the chord list excludes section headers and tab refs. Without this, every song's chip row would read "Am, C, D, Verse 1, Chorus, Bridge."

**Note it operates on the whole sheet, not line by line** — so it also catches a `[Verse]` that isn't alone on its line. Broader than the section check, appropriately.

**The same limitation applies:** a section header not on the list and containing no space still slips through as a chord. `[Breakdown]` would land in `Note.chords`, and `getChordShape("Breakdown")` would then try to resolve `B` + `"reakdown"`.

---

## `extractTabRefs(sheet)`

```ts
export function extractTabRefs(sheet: string): string[] {
  const out: string[] = [];
  for (const line of sheet.replace(/\r\n/g, "\n").split("\n")) {
    const m = line.match(TABREF_RE);
    if (m) out.push(m[1].trim());
  }
  return out;
}
```

> *"Names referenced by `[tab: Name]` lines, in document order (may repeat)."*

**The only `for...of` loop in the file** — everything else uses `while (exec())` or `.map()`. Used here because it's a simple per-line test with no regex state to manage.

**"may repeat" — no deduplication**, unlike `extractChords`. Deliberate: a song may reference the same riff twice (`[tab: Riff]` in the intro and again in the outro), and both occurrences must render. Position in the flow is the point; uniqueness isn't.

**Line-based, not sheet-based** — `TABREF_RE` is anchored to the whole line, so a `[tab: X]` mid-lyric isn't a reference. Consistent with `parseChordLine`'s Phase 2.

**The CRLF normalisation is repeated** from `parseChordSheet` rather than extracted to a helper. Minor duplication; the alternative is a one-line function that adds indirection.

---

## Confirmed bug: section headers get transposed

`isNonChordLabel` correctly protects section headers **during parsing** — but [`transposeChordSheet`](transpose.ts.md) operates on the **raw text before parsing** and doesn't consult it. Verified by running the real module:

```
[Bridge]  transposed +2  →  [C#ridge]
[Chorus]  transposed +2  →  [Dhorus]
[Verse 1] transposed +2  →  [Verse 1]   ✓ (V is not A–G)
[Intro]   transposed +2  →  [Intro]     ✓ (I is not A–G)
```

The mechanism: `CHORD_RE` in `transpose.ts` is `/^([A-G][#b]?)(.*)$/`, which happily reads `"Bridge"` as root `B` + opaque quality `"ridge"`. Labels are only safe when their first letter falls outside A–G.

**Affected labels from `NON_CHORD_LABELS`:** `chorus`, `bridge`, `ad-libs`. All others begin with a letter outside A–G and survive by luck, not design.

**Downstream effect:** once `[Bridge]` becomes `[C#ridge]`, it no longer matches `isNonChordLabel`, so `parseChordLine` reclassifies it from a section header to an inline chord — the header disappears and a bogus chord diagram appears.

**The fix** would be for `transposeChordSheet` to import and apply the same filter this file already exports the pieces for. Note `isNonChordLabel` is currently **not exported**, which is presumably why it wasn't reused.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `if (line.trim() === "")` | Phase 1 | Cheapest, unambiguous test first |
| `if (tabref)` before `if (section)` | Phases 2–3 | `[tab: X]` also matches `SECTION_RE` — most specific first |
| `section && (/\s/ \|\| isNonChordLabel)` | Phase 3 | The chord-vs-header disambiguation |
| `while ((match = re.exec()))` ×2 | Phase 4, `extractChords` | Iterate all `/g` matches with `.index` access |
| `re.lastIndex = 0` ×2 | both loops | `/g` regexes carry mutable state across calls |
| `if (segments.length === 0 && before)` | Phase 4 | Pre-first-marker text has no chord above it |
| `if (match[1] !== undefined)` | Phase 4 | Which alternation branch matched |
| `if (segments.length === 0)` | Phase 4 | Pure-lyric early return |
| `if (...) continue` | `extractChords` | Three-way non-chord filter |
| `for...of` | `extractTabRefs` | Simple per-line test, no regex state |
| `Set` + array | `extractChords` | Dedupe while preserving first-appearance order |

---

## Related

- [`lib/music/transpose.ts`](transpose.ts.md) — has the same `[Bridge]` problem and lacks this file's filter
- [`lib/strumming.ts`](../strumming.ts.md) — `StrokeType`, the `{D}` marker vocabulary
- [`components/notes/ChordLyricsView.svelte`](../../components/notes/ChordLyricsView.svelte.md) — renders `ParsedLine[]`
- [`components/create/CreateNoteForm.svelte`](../../components/create/CreateNoteForm.svelte.md) — calls `extractChords` to populate `Note.chords`
- [`lib/types.ts`](../types.ts.md) — `Note.chords`, `Note.tabBlocks`, and the `[tab: Label]` contract
