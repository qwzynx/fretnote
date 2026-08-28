# `src/components/notes/NoteReader.svelte`
**Role:** The playing view — toolbar (transpose, font size, detail, auto-scroll), chord diagrams, strumming, and the body. **342 lines.**

## Tuning
```ts
// The note carries its own tuning, so a Drop D tab labels its stave D A D
// G B e rather than borrowing whatever the app-wide default happens to be.
const tuning = $derived(TUNINGS.find(t => t.id === note.tuning) ?? DEFAULT_TUNING);
```
The payoff for [`types.ts`](../../lib/types.ts.md)'s decision to store `tuning` on the note rather than in settings. `stringNames` is then threaded into every `TabView` and `TabHintView`.

## Settings seeding
```ts
const _s = getSettings();
let fontSize = $state(_s.defaultFontSize);
let speed = $state(_s.defaultScrollSpeed);
```
**Read once, non-reactively.** Settings *seed* the reader; changing them mid-session doesn't retroactively alter an open note. Exactly the `default*` semantics [`settings.ts`](../../lib/settings.ts.md) describes.

## `scrollHost()` — finding the real scroller
```ts
let el = rootEl?.parentElement ?? null;
while (el) {
  const overflowY = getComputedStyle(el).overflowY;
  if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) return el;
  el = el.parentElement;
}
return document.scrollingElement as HTMLElement;
```
> *"The app shell scrolls an inner element, not the window, so walk up to whichever ancestor actually owns the overflow."*

**The same fact [`Popover`](../ui/Popover.svelte.md) has to work around with a capture-phase scroll listener.** `window.scrollTo` does nothing in this app. The walk finds the nearest scrollable ancestor — which is `App.svelte`'s container on desktop but a `SectionSwipe` pane on phones, so it can't be hardcoded.

**`el.scrollHeight > el.clientHeight`** — an `overflow: auto` element that isn't actually overflowing isn't the scroller. Without this check the loop could stop at the wrong ancestor.

**`document.scrollingElement` fallback** for the case where nothing matches.

## The auto-scroll `$effect`
```ts
if (!scrolling) { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTs = 0; } return; }
```
Early exit that also cleans up — so toggling off stops the loop even though the effect's own cleanup would too.

```ts
// Reading clientHeight/scrollHeight straight after writing scrollTop
// forced a synchronous layout on every single frame. They only change
// when the content or viewport does, so measure once and refresh on
// those events instead.
let maxScroll = host.scrollHeight - host.clientHeight;
const ro = new ResizeObserver(remeasure);
```
**A layout-thrashing fix.** Writing `scrollTop` then reading `scrollHeight` in the same frame forces the browser to flush layout synchronously — 60 times a second. Caching the value and refreshing it only on `ResizeObserver` + `resize` removes the read from the hot path entirely.

```ts
// Sub-pixel remainder, so slow speeds still creep instead of stalling.
let offset = 0;
offset += (_speed * (ts - lastTs)) / 1000;
const whole = Math.trunc(offset);
if (whole > 0) { host.scrollTop += whole; offset -= whole; }
```
**The accumulator is essential.** `scrollTop` snaps to integers, so at 5 px/s a frame's movement is ~0.08px — assigning it repeatedly would round to zero and the page would never move. Accumulating the fraction and applying only whole pixels means slow speeds work.

**`(ts - lastTs)` — delta time**, so the speed is px/*second* regardless of frame rate. A dropped frame doesn't slow the scroll.

**`if (lastTs)`** skips the first frame, which has no previous timestamp.

**`host.scrollTop >= maxScroll - 1` → `scrolling = false`** — stop at the bottom. The `- 1` absorbs sub-pixel rounding, where an exact `>=` could never be reached.

**`const _speed = speed`** captures speed as a tracked dependency, so changing the slider restarts the effect with the new value.

**The cleanup** cancels the frame, disconnects the observer, removes the listener, resets `lastTs`.

## `handleKey`
```ts
if ((e.target as HTMLElement).matches("input, textarea, select, [contenteditable]")) return;
if (e.ctrlKey || e.metaKey || e.altKey) return;
```
**The `isTyping` check is duplicated from [`App.svelte`](../../App.svelte.md)** — the same selector string, copied. And the modifier check is *inverted* relative to `App.svelte`'s: there, modifiers gate the *global* shortcuts in; here they gate the *local* ones out, so `Ctrl+K` reaches the global handler rather than being eaten.

Four bindings: `Space` (with `preventDefault` so it doesn't page-scroll), `[`/`]` **guarded by `note.type === "chords"`** (transposing a tab is meaningless), `+`/`=` and `-` for font size via `clampFont`.

**`e.key === "+" || e.key === "="`** — on most layouts `+` requires Shift, so `=` is accepted as the unshifted equivalent. A small usability detail.

**These are the shortcuts [`KeyboardShortcutsHelp`](../KeyboardShortcutsHelp.svelte.md) documents by hand** — nothing links the two.

## Template
- **`sticky top-0 z-20`** with the comment explaining `top-0`: *"the sticky context is the app's scroll container, which already starts below the header."*
- **`-mx-4 … px-4`** — full-bleed so the toolbar's background spans the gutters.
- **`{#if note.type === "chords"}`** hides the whole transpose group for tabs.
- **`{#if transpose !== 0}`** reveals the reset button only when it would do something.
- **`min-w-14` on the key readout** stops the toolbar reflowing as `"C"` becomes `"F#"`.
- **`variant={detailed ? "default" : "outline"}`** and the same for auto-scroll — a filled button as the "on" state, cheaper than a separate toggle component.
- **`{#if scrolling}` … `sm:hidden` speed row** — *"Phone: speed control surfaces only while the page is moving."* Desktop always shows its slider; phones reclaim the space.
- **`data-no-swipe-nav`** on the chord strip — the third use of that opt-out.
- **`transposeKey(c, note.type === "chords" ? transpose : 0)`** — chord diagrams follow the transpose, but only for chord sheets.
- **`note.strummingPattern?.some(s => s !== "")`** — an all-rests pattern is treated as absent. Stricter than a truthiness check, and correct: [`emptyPattern()`](../../lib/strumming.ts.md) returns eight empty strings.
- **`note.strummingPattern as StrokeType[]`** — the cast `types.ts` avoids by declaring the field `string[]`.
- **The body branch** mirrors `NotePage`'s: `chords && chordSheet` → `ChordLyricsView`, else `tabBlocks?.length` → a keyed loop of `TabView`/`TabHintView`. **The hint+tab layout markup is duplicated verbatim from [`ChordLyricsView`](ChordLyricsView.svelte.md)'s tabref branch.**

**Related:** [`ChordLyricsView.svelte`](ChordLyricsView.svelte.md), [`TabView.svelte`](TabView.svelte.md), [`lib/music/transpose.ts`](../../lib/music/transpose.ts.md), [`lib/settings.ts`](../../lib/settings.ts.md), [`App.svelte`](../../App.svelte.md)
