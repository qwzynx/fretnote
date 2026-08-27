# `src/lib/strumming.ts`

**Role:** The vocabulary of strumming patterns — what a stroke can be, how it's drawn, and how beats are labelled.
**Size:** 27 lines. **Depends on:** nothing. Pure data.

---

## `StrokeType`

```ts
export type StrokeType = "D" | "U" | "d" | "u" | "X" | "";
```

A closed union of six single-character codes. **The case is significant:** `D` and `d` are different values — accented vs. soft. That's an unusual choice in a codebase and worth flagging, because it means any comparison must not normalise case, and a `.toUpperCase()` anywhere in this path would silently destroy dynamics.

| Code | Meaning |
|---|---|
| `D` | Accented downstroke |
| `U` | Accented upstroke |
| `d` | Soft downstroke (ghost) |
| `u` | Soft upstroke (ghost) |
| `X` | Muted / percussive "chuck" |
| `""` | Rest — hand keeps moving, strings don't sound |

**Why single characters:** A pattern is `StrokeType[]`, serialised to a JSON array in the `strumming_pattern` column (see [`types.ts`](types.ts.md): `strummingPattern?: string[]`). Single chars keep that column tiny and human-readable when you inspect the database directly.

**Why `""` for rest rather than `null` or omitting the slot:** A pattern is **positional** — index 3 *is* beat "&" of 2. A rest has to occupy its slot to keep the grid aligned. Using `""` instead of `null` also means the whole union is `string`, so it round-trips through `JSON.parse` with no null-handling and matches the `string[]` type on `Note`.

---

## `STROKE_CYCLE`

```ts
export const STROKE_CYCLE: StrokeType[] = ["D", "U", "d", "u", "X", ""];
```

This array's **order is a UI behaviour**, not just a list. It defines what happens when you tap a strum slot in the editor: each tap advances to the next entry, wrapping at the end. The implementation in `StrummingEditor.svelte` is the standard modulo step:

```ts
const next = STROKE_CYCLE[(STROKE_CYCLE.indexOf(current) + 1) % STROKE_CYCLE.length];
```

The order is chosen so the common cases come first — `D` then `U` covers most patterns in two taps — with `X` and rest at the end. `""` being last means one more tap from any state returns you to empty, which is the "undo" a user reaches for.

**Note it's typed `StrokeType[]`, not `as const`.** Unlike `SECTION_ORDER` in [`sections.ts`](sections.ts.md), this is mutable and its element type is the wide union. The explicit annotation still buys the important guarantee: adding a stroke code here that isn't in `StrokeType` is a compile error. Adding one to the *type* without adding it here is not caught — it would just be unreachable by tapping. That's the fragile direction.

---

## `STROKE_DISPLAY`

```ts
export const STROKE_DISPLAY: Record<
  StrokeType,
  { symbol: string; label: string; className: string }
> = { ... };
```

A lookup table from stroke code to how it renders.

**`Record<StrokeType, ...>` is the load-bearing part.** Because the key type is the exhaustive union, TypeScript requires *every* member to be present. Add a `"P"` stroke to `StrokeType` and this object fails to compile until you give it a symbol, label, and class. That's exhaustiveness checking via the type system rather than a runtime default — the reason there's no `?? fallbackDisplay` anywhere in the consumers.

### The three fields

```ts
D: { symbol: "↓", label: "Down",         className: "text-primary" },
U: { symbol: "↑", label: "Up",           className: "text-primary" },
d: { symbol: "↓", label: "Soft down",    className: "text-primary/50" },
u: { symbol: "↑", label: "Soft up",      className: "text-primary/40" },
X: { symbol: "✕", label: "Mute / chuck", className: "text-muted-foreground" },
"": { symbol: "·", label: "Rest",        className: "text-muted-foreground/30" },
```

- **`symbol`** — what's drawn. Note `D`/`d` share `↓` and `U`/`u` share `↑`. **Dynamics are encoded in colour, not glyph**, which is why `className` can't be dropped without losing information.
- **`label`** — human-readable, used for tooltips and `aria-label`. This is the accessibility path: a screen reader gets "Soft down", not "↓".
- **`className`** — Tailwind classes using the design tokens from `globals.css`.

### Reading the opacity ladder

The `className` values encode a deliberate visual hierarchy through Tailwind's `/N` opacity modifier:

```
text-primary            (100%)  D, U   ← accented, full attention
text-primary/50          (50%)  d      ← soft
text-primary/40          (40%)  u      ← softer still
text-muted-foreground           X      ← different colour entirely: not a pitch
text-muted-foreground/30 (30%)  ""     ← barely there: grid scaffolding
```

Two separate signals: **hue** distinguishes "produces a note" (`primary`) from "doesn't" (`muted-foreground`); **opacity** encodes intensity within each. A player scanning the pattern sees accents pop out.

The `d` (50%) vs `u` (40%) asymmetry is a small deliberate touch — upstrokes are usually lighter than downstrokes even when both are "soft."

**Why classes and not inline styles:** these reference CSS custom properties (`--primary`, `--muted-foreground`) defined in `globals.css`, so the whole pattern retints with the theme for free.

**Note the quoted key:** `"": { ... }` — the empty string needs quoting to be a valid object key. Easy to miss when scanning.

---

## `LABELS_8` and `LABELS_16`

```ts
export const LABELS_8 = ["1", "&", "2", "&", "3", "&", "4", "&"];
export const LABELS_16 = [
  "1", "e", "&", "a",
  "2", "e", "&", "a",
  "3", "e", "&", "a",
  "4", "e", "&", "a",
];
```

Standard rhythmic counting syllables for one bar of 4/4.

- **Eighth notes** — "one and two and three and four and."
- **Sixteenth notes** — "one-e-and-a, two-e-and-a, …"

These are how drummers and guitar teachers verbalise subdivisions, so putting them under the strum grid means the on-screen pattern matches how a player would count it aloud. Not decoration — it's the notation.

**`LABELS_16`'s formatting is the documentation.** The source is laid out four-per-line so each row is visually one beat. That grouping is invisible in the resulting flat array but makes the structure obvious to anyone reading or editing the file.

**Neither has an `as const` or explicit type** — both infer as `string[]`. They're only ever read and rendered, never indexed by a literal type, so nothing is lost.

**The implicit contract:** consumers pick `LABELS_8` or `LABELS_16` based on `pattern.length`. Nothing in this file enforces that a pattern is 8 or 16 long — a 12-slot pattern would run off the end of both label arrays and render `undefined`. The constraint is upheld by `emptyPattern()` and by the editor UI, not by types.

---

## `emptyPattern()`

```ts
export function emptyPattern(): StrokeType[] {
  return Array(8).fill("") as StrokeType[];
}
```

The only function in the file.

**`Array(8)`** creates a *sparse* array — length 8, but with no actual elements (holes). On its own this is dangerous: `map` and `forEach` skip holes, so `Array(8).map(...)` returns 8 holes.

**`.fill("")`** is what makes it safe. It writes `""` into every index, converting holes into real properties. After this the array is dense and iterates normally. `Array(8).fill("")` is the standard idiom for "n copies of a value" precisely because of this pairing — neither half works alone.

**The `as StrokeType[]` cast:** `.fill("")` on an `any[]` infers `string[]`, and `string[]` isn't assignable to `StrokeType[]` (a `string` could be `"Q"`). The cast asserts what's true by construction: every element is `""`, which *is* a valid `StrokeType`. A cast that narrows rather than widens — safe.

**Why 8 and not 16:** Eighth-note patterns cover the large majority of guitar strumming. The editor lets you expand to 16; 8 is the starting point.

**Why a function and not a constant:** Returning a shared `EMPTY_PATTERN` constant would hand every note the *same array object*. Editing one song's pattern would mutate every other new note's starting pattern. Same reasoning as the `{ ...DEFAULT_SETTINGS }` spread in [`settings.ts`](settings.ts.md) — fresh mutable object per call.

---

## Control flow summary

| Construct | Where | Purpose |
|---|---|---|
| `Array(8).fill("")` | `emptyPattern` | Build a dense array; `fill` is required to avoid holes |
| type-level exhaustiveness | `Record<StrokeType, …>` | Compiler enforces every stroke has a rendering |

No `if`, no explicit loops, no async. This is a data module: the branching lives in the consumers that index into these tables.

---

## Related

- [`components/create/StrummingEditor.svelte`](../components/create/StrummingEditor.svelte.md) — uses `STROKE_CYCLE` for tap-to-advance
- [`components/create/StrummingPreview.svelte`](../components/create/StrummingPreview.svelte.md) — renders via `STROKE_DISPLAY` + labels
- [`components/create/StrumPanel.svelte`](../components/create/StrumPanel.svelte.md)
- [`lib/types.ts`](types.ts.md) — `Note.strummingPattern`, `Note.bpm`
- [`app/globals.css`](../app/globals.css.md) — the `--primary` / `--muted-foreground` tokens
