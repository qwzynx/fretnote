# `src/components/notes/ChordDiagram.svelte`
**Role:** Draws a chord fingering as an SVG grid. **194 lines.**

## Data
```ts
const shape = $derived(getChordShape(name));       // null if unknown
const fingering = $derived(shape ? fingerChord(shape) : null);
const barre = $derived(fingering?.barre);
```
The consumer of [`chords.ts`](../../lib/music/chords.ts.md) and [`fingering.ts`](../../lib/music/fingering.ts.md). `getChordShape` is memoised there — including misses — which matters because a song renders one diagram per chord occurrence.

## The coordinate system
```ts
const W = 100, H = 132;
const padL = 24, padR = 8, padTop = 26;
const gridW = W - padL - padR;   // 68
const gridH = 78;
const stringGap = gridW / (strings - 1);
const fretGap = $derived(gridH / fretCount);
const x = (s) => padL + s * stringGap;
const y = (f) => padTop + f * fretGap;
```
**A viewBox, not pixels** — the SVG scales to whatever `max-w-[110px]` (or a caller's class) allows, and all the maths stays in one fixed coordinate space.

> *"Wider on the left so a two-digit base-fret label ('12fr') doesn't clip against the viewBox edge."*

**`padL = 24` vs `padR = 8`** — asymmetric padding for the `"12fr"` label drawn at `x = padL - 5`.

**`gridW / (strings - 1)`** — 5 gaps between 6 strings, not 6. The classic fencepost.

**`x(s)` indexes low-E-first**, matching `shape.frets` — so unlike the tab renderers, **no reversal happens here**. A chord diagram is conventionally drawn low-E on the *left*, which is the same direction as storage order.

## Rendering branches

**Nut vs base-fret label:**
```svelte
{#if baseFret === 1} <rect …3px thick… /> {:else} <text>{baseFret}fr</text> {/if}
```
A thick bar for the nut (open position), or a fret number when the shape sits up the neck. This is what [`shiftShape`](../../lib/music/chords.ts.md)'s `minPressed > 3 ? minPressed : 1` decision feeds.

**Two grid loops** — `fretCount + 1` horizontal lines (6 lines bound 5 frets) and `strings` vertical lines. `Array.from({length: n})` with the index from `as _, i`.

**The barre**, drawn first so dots render over it: a rounded `<rect>` spanning `x(from)-4` to `x(to)+4`, plus a circle and finger number at the midpoint. **`y(barre.fret - baseFret)`** converts an absolute fret to a grid row — the same subtraction used for dots.

**The per-string loop** is a four-way branch:
```svelte
{#if fret === -1}          × above the nut (muted)
{:else if fret === 0}      hollow circle above the nut (open)
{:else if !(barre && barre.fret === fret && s >= barre.from && s <= barre.to)}
                           filled dot + finger number
{/if}
```
**The third condition is the one to read carefully:** skip drawing a dot for any string *already covered by the barre rect*. Without it, a barre chord gets six dots stacked on top of the bar. There is no `{:else}` — a barred string draws nothing extra, which is correct.

**`+ fretGap / 2`** centres the dot *between* fret lines, where a finger actually goes.

**`r={showFingers ? 6 : 5}`** — a slightly larger dot when a number has to fit inside it.

**`{:else}` on `{#if shape}`** renders `"shape n/a"` — the graceful degradation for `getChordShape` returning `null`, which happens for flat-named chords not in the table (see `chords.ts`).

## Other details
- **`role="img"` + `aria-label="{name} chord diagram"`** — an SVG is otherwise a soup of unlabelled shapes to a screen reader.
- **`<style>` block with five classes** — because SVG `font-size` can't be set by Tailwind's `text-*` utilities (which set `font-size` in `rem` on HTML elements but don't apply cleanly to SVG text metrics here). Fixed `px` values in the viewBox's coordinate space are what's needed.
- **Colours *are* Tailwind** (`fill-primary`, `stroke-border`) — so the diagram themes with the palette while its type scale stays in SVG units.
- **`y={cy + 3}`** on finger numbers — a manual baseline nudge, since SVG text is positioned by baseline, not centre. `dominant-baseline="middle"` would be the declarative alternative.

**Related:** [`lib/music/chords.ts`](../../lib/music/chords.ts.md), [`lib/music/fingering.ts`](../../lib/music/fingering.ts.md), [`ChordLyricsView.svelte`](ChordLyricsView.svelte.md)
