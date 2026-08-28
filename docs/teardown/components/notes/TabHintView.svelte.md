# `src/components/notes/TabHintView.svelte`
**Role:** Renders a `TabHint` — the recommended hand shape for a tab fragment. **40 lines.**

## Module-level settings read
```ts
const settingsTuning = TUNINGS.find(t => t.id === getSettings().defaultTuning) ?? DEFAULT_TUNING;
```
**Runs once at module load, not per instance.** So the default string labels are fixed for the session — changing the tuning in Settings won't update an already-loaded page. Acceptable because it's only a *default*: every real call site passes `stringNames` explicitly from the note's own tuning ([`ChordLyricsView`](ChordLyricsView.svelte.md) does).

**`?? DEFAULT_TUNING`** — a stored tuning id that no longer exists falls back rather than crashing. The kind of guard [`tunings.ts`](../../lib/music/tunings.ts.md)'s id/label split makes cheap.

## The fingering
```ts
const fingering = $derived(fingerShape(hint.frets));
```
**No `anchor` passed** — a hand shape is a standalone grip with no phrase context, so it defines its own position. Same call shape as `fingerChord`, minus the barre (a `TabHint` has no declared barre; [`fingerShape`](../../lib/music/fingering.ts.md) infers one if there are more notes than fingers).

## Template
```svelte
<div class={cn("w-[8.5rem] shrink-0 font-sans sm:w-[152px]", className)}>
```
**`w-[8.5rem]` and `sm:w-[152px]`** — these are exactly the two values [`globals.css`](../../app/globals.css.md)'s comment says were consolidated into `--spacing-fretboard` (*"previously written as both `w-[152px]` and `w-[8.5rem]` across four files"*). **This file still has both**, unconverted — the token exists but this call site wasn't migrated. A live example of an incomplete consolidation.

**`font-sans`** explicitly resets the face, because this sits inside `ChordLyricsView`'s `font-mono` container.

**`label={hint.shape ? \`${hint.shape} shape\` : "Recommended hand shape for this tab"}`** — the accessible name, specific when the grip is named and descriptive otherwise. Note the fallback is a full sentence for screen readers rather than the terser "hand shape" that [`export.ts`](../../lib/export.ts.md) uses in text output.

**Two optional blocks:** `{#if hint.shape}` renders the name in mono/primary; `{#if hint.note}` renders the free-text advice at `text-3xs`. Both are optional on the type, and the component degrades to just the diagram.

**`truncate` on the shape name** — a long grip name like `"Am (5fr)"` can't break the fixed-width column.

**Related:** [`lib/types.ts`](../../lib/types.ts.md) (`TabHint`), [`lib/music/fingering.ts`](../../lib/music/fingering.ts.md), [`FingerFretboard.svelte`](FingerFretboard.svelte.md), [`app/globals.css`](../../app/globals.css.md)
