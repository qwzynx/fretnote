# `src/components/notes/FingerFretboard.svelte`
**Role:** Draws a hand shape on a windowed slice of the neck, with fret numbers. **223 lines.**

The larger sibling of [`ChordDiagram`](ChordDiagram.svelte.md). Same SVG approach, but with a **sliding fret window** and support for `StringState`'s `null`.

## The window calculation — the interesting part
```ts
const baseFret = $derived.by(() => {
  if (pressed.length === 0) return 1;
  const maxFret = Math.max(...pressed);
  const position = fingering.position || Math.min(...pressed);
  const hasOpen = frets.some(f => f === 0);
  if ((hasOpen || position <= 1) && maxFret <= fretCount) return 1;
  if (position + fretCount - 1 >= maxFret) return Math.max(1, position);
  return Math.max(1, maxFret - fretCount + 1);
});
```
> *"The window sits at the hand position, so stepping through a phrase played in one position doesn't slide the board around. Shapes that ring an open string are drawn from the nut instead — an open-string marker only makes sense with the nut in view."*

**Three cases, in priority order:**

1. **`(hasOpen || position <= 1) && maxFret <= fretCount` → nut.** Two reasons to anchor at fret 1: an open string is only meaningful with the nut visible (an "open" marker floating above fret 7 is nonsense), or the hand is already at the nut. Both require the shape to *fit* in the window.
2. **`position + fretCount - 1 >= maxFret` → `position`.** The hand position works as the window start because everything fits from there. **This is the stability property the comment describes** — stepping through a phrase in 5th position keeps the board at 5.
3. **Otherwise → `maxFret - fretCount + 1`.** The shape is wider than the window; slide down so the highest note is visible. A fallback that shouldn't occur, since [`fingering.ts`](../../lib/music/fingering.ts.md)'s `FRET_SPAN` bounds a hand to 4 frets.

**`fingering.position || Math.min(...pressed)`** — `position` is `0` when nothing is fretted (`fingerShape`'s sentinel), so `||` falls back. Correct use of `||` over `??` here: `0` is exactly the value to reject.

**`Math.max(1, …)`** everywhere — the window can never start below fret 1.

## Helpers
```ts
const slot = (fret) => y(fret - baseFret) + fretGap / 2;
const inWindow = (fret) => fret >= baseFret && fret < baseFret + fretCount;
```
**`inWindow` is the guard that makes the sliding window safe** — a note outside the drawn range is simply not rendered rather than drawn off-grid. Used for both the barre and the dots.

## Rendering
**String labels** dim (`fill-muted-foreground/50`) when the string is `null` or `-1` — so an unplayed string is visibly de-emphasised at a glance. `ChordDiagram` has no equivalent because a chord always decides every string.

**`stroke-width={frets[s] === null ? 0.75 : 1.25}`** — **untouched strings are drawn thinner**. A second, subtler channel for the same information. This is the `StringState` `null` state made visual, and it's the main thing this component does that `ChordDiagram` can't.

**The nut is drawn only when `baseFret === 1`** — and unlike `ChordDiagram` there's no `{:else}` label, because fret numbers run down the left gutter on *every* row (`{baseFret + row}`). That's why `padL = 32` here vs `24` there.

**The barre and dot loops mirror `ChordDiagram`'s**, with two additions: `inWindow()` guards, and `{finger > 0 ? finger : ""}` renders an empty label rather than `0` when no finger was assigned.

**`onBarre`** is hoisted into a `{@const}` rather than inlined in the `{#if}` — the same skip-dots-under-the-bar logic, more readable.

**`{#if pressed.length === 0}` → "no fingers needed"** — the all-open-strings case (an Em7 shape, say). A real state, unlike `ChordDiagram`'s "shape n/a" which means *lookup failed*.

**`<style>` block** for SVG font sizes, same reason as `ChordDiagram`.

**Related:** [`lib/music/fingering.ts`](../../lib/music/fingering.ts.md), [`ChordDiagram.svelte`](ChordDiagram.svelte.md), [`TabHintView.svelte`](TabHintView.svelte.md)
