# `src/components/notes/ChordLyricsView.svelte`
**Role:** Renders a parsed chord sheet — chords positioned above lyrics, section headers, inline tabs. **128 lines.**

**The heart of the reading experience.** Consumes [`parse.ts`](../../lib/music/parse.ts.md)'s `ParsedLine[]`.

## The pipeline
```ts
const lines = $derived(parseChordSheet(transposeChordSheet(sheet, transpose)));
```
**Transpose first, then parse.** That ordering is what causes the `[Bridge]` → `[C#ridge]` bug documented in [`transpose.ts`](../../lib/music/transpose.ts.md): the section header is mangled *before* `parseChordSheet` gets a chance to recognise it. Parsing first and transposing only the chord segments would fix it.

Both are memoised by `$derived`, so a font-size change doesn't re-parse.

## The four-way line dispatch
Consumes the discriminated union directly:

**`blank`** → `<div style="height: {fontSize * 1.4}px">` — a spacer scaled to the font size, so vertical rhythm holds as the reader zooms.

**`section`** → a small uppercase primary-coloured header. `first:mt-0` cancels the top margin on the first line.

**`tabref`** → looks up the block:
```svelte
{@const block = tabBlocks.find(b => b.label.trim().toLowerCase() === line.name.toLowerCase())}
```
Case- and whitespace-insensitive matching, same as [`export.ts`](../../lib/export.ts.md)'s `normalizeLabel`. **`{#if block}` … `{:else}`** renders `No tab named "X" yet.` — a visible warning, unlike the PDF exporter which silently draws nothing. Better behaviour here.

Nested: `{#if block.hint}` puts [`TabHintView`](TabHintView.svelte.md) beside [`TabView`](TabView.svelte.md) (stacked on phones via `flex-col sm:flex-row`), otherwise the tab alone.

**`lyric`** → the segment loop.

## The segment rendering
```svelte
<span class="inline-flex max-w-full flex-col sm:max-w-none">
  <span class="…chord row…">…</span>
  <span class="whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal">
    {seg.text === "" ? " " : seg.text}
  </span>
</span>
```
**Each segment is a two-row flex column: chord on top, lyric below.** This is fundamentally different from [`export.ts`](../../lib/export.ts.md)'s PDF approach (a padded monospace chord line above a lyric line). Here alignment comes from **layout**, not character counting — each chord is literally the element above its syllable, so it stays aligned at any font size and through any wrap.

**`h-5 leading-5` on chordless segments** reserves the chord row's height, so lyric baselines line up whether or not a chord sits above.

**`seg.text === "" ? " " : seg.text`** — an empty segment (two adjacent markers) gets a space, so the flex column has width and the chord isn't zero-wide.

**`whitespace-pre-wrap break-words` → `sm:whitespace-pre sm:break-normal`** — phones wrap inside long words to avoid horizontal scroll; desktop preserves exact spacing and lets the container scroll (`sm:overflow-x-auto` on the root). Two reading models for two screen sizes.

**`flex-wrap … sm:flex-nowrap`** on the line — same idea at the line level.

## `detailed` mode
```svelte
{#if detailed} <ChordDiagram name={seg.chord} class="w-14" frets={4} showFingers={false} />
{:else} <Popover> …chord name button… <ChordDiagram name={seg.chord!} /> </Popover> {/if}
```
**Two modes:** inline mini-diagrams above every chord (`detailed`), or a tappable chord *name* that opens a [`Popover`](../ui/Popover.svelte.md) with a full diagram. The popover mode is the default — far denser, and the reason `Popover` needs its portal and flip-above logic (see that file).

**`showFingers={false}` in detailed mode** — at `w-14` the finger numbers wouldn't be legible.

**`seg.chord!`** — a non-null assertion inside the snippet, since narrowing doesn't cross the snippet boundary.

**Strum marks render only in `detailed` mode**, via `STROKE_DISPLAY[seg.strum]` — symbol, `title` tooltip from `label`, colour from `className`. All three fields of that table used at once. Note the PDF exporter falls back to plain letters because Courier lacks the arrow glyphs.

**`font-size: {fontSize * 0.82}px`** on chords — proportionally smaller than lyrics, scaling together.

**Related:** [`lib/music/parse.ts`](../../lib/music/parse.ts.md), [`lib/music/transpose.ts`](../../lib/music/transpose.ts.md), [`ChordDiagram.svelte`](ChordDiagram.svelte.md), [`TabView.svelte`](TabView.svelte.md), [`components/ui/Popover.svelte`](../ui/Popover.svelte.md)
