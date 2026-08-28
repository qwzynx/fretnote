# `src/components/create/NotePreview.svelte`
**Role:** Live preview of the note being edited, rendered with the real reading components. **226 lines.**

**Reuses [`ChordLyricsView`](../notes/ChordLyricsView.svelte.md), [`ChordDiagram`](../notes/ChordDiagram.svelte.md), [`TabView`](../notes/TabView.svelte.md), [`TabHintView`](../notes/TabHintView.svelte.md), [`FingerLegend`](../notes/FingerLegend.svelte.md)** — the same components the reader uses, so what you see while writing is genuinely what you get. That reuse is the design.

## Derived state
```ts
const hasPattern  = $derived(pattern.some(s => s !== ""));
const hasSheet    = $derived(sheet.trim().length > 0);
const filledTabs  = $derived(tabBlocks.filter(tabBlockFilled));
const hasTab      = $derived(filledTabs.length > 0);
const hasBody     = $derived(hasPattern || chords.length > 0 || hasSheet || hasTab);
```
**Each `has*` asks "is this section worth rendering?"** — and each uses a *content* test rather than existence. `tabBlockFilled` checks `columns.some(col => col.some(v => v !== ""))`, so a block the user created but hasn't filled in doesn't render an empty stave. Same instinct as `hasPattern` ignoring an all-rest pattern.

**`hasBody`** gates the "nothing yet" placeholder — an OR across all four.

## The unplaced-tabs feature
```ts
const referenced = $derived(new Set(extractTabRefs(sheet).map(n => n.toLowerCase())));
const unplacedTabs = $derived(filledTabs.filter(b => !referenced.has(b.label.trim().toLowerCase())));
```
**The most interesting logic here.** A tab block can be *referenced inline* via `[tab: Solo]`, in which case `ChordLyricsView` already renders it in the flow. A block that isn't referenced anywhere would otherwise be invisible in the preview — the author would think it was lost.

So: build a `Set` of referenced names, then show only the blocks *not* in it, under **"Tabs not placed yet"**. The heading is doing real work — it tells the author both that the block exists and that it hasn't been positioned.

**`.toLowerCase()` on both sides plus `.trim()` on the label** — the same case/whitespace-insensitive matching as `ChordLyricsView`'s lookup and [`export.ts`](../../lib/export.ts.md)'s `normalizeLabel`. Three implementations of one rule.

**A `Set` for O(1) membership** across the filter — the same pattern as `extractChords`.

## Details
- **`fontSize` is local with its own `MIN_FONT = 13` / `MAX_FONT = 22`** — a *narrower* range than [`NoteReader`](../notes/NoteReader.svelte.md)'s 12–26, since the preview lives in a column and can't use the full width. It's also **not seeded from settings**, unlike the reader.
- **`{#if title}` / `{:else}` → "Untitled note"** in muted text; `{artist || "Unknown artist"}` inline. Two idioms for the same placeholder idea in adjacent lines.
- **`{#if capo > 0}` / `{:else} No capo`** — an explicit "No capo" rather than omitting, which is right for a preview: the author is checking that a field is set.
- **`DIFFICULTY_LABEL`** — a *fourth* copy of this map.
- **`chords.length` in the heading** ("Chords in this song (5)") gives the author a count to sanity-check against what they've written.
- **The empty-state box is hand-rolled** rather than using [`EmptyState`](../ui/EmptyState.svelte.md) — a fourth hand-rolled empty state. Its copy points at where to act (*"on the left"*), which is the one thing the shared component couldn't supply.
- **`songKey`, not `key`** — `key` is reserved in Svelte templates.
- **`TabView` in the unplaced section is given no `stringNames`**, so it falls back to standard tuning while `TabHintView` beside it gets the real one. An inconsistency: a Drop D tab would label its stave wrong here.

**Related:** [`CreateNoteForm.svelte`](CreateNoteForm.svelte.md), [`components/notes/ChordLyricsView.svelte`](../notes/ChordLyricsView.svelte.md), [`lib/music/parse.ts`](../../lib/music/parse.ts.md)
