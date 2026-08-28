# `src/components/notes/NoteCard.svelte`
**Role:** A song card for the feed, optionally with a swipe-to-reveal action tray. **240 lines.**

## Module constants
```ts
const TRAY_WIDTH = 128;   // must match the tray's w-32 (8rem = 128px)
// Built once for the whole feed. Constructing an Intl formatter per card
// per render is a surprisingly large share of a long list's render cost.
const DATE_FMT = new Intl.DateTimeFormat(undefined, {year:"numeric",month:"short",day:"numeric"});
```
**`Intl.DateTimeFormat` is genuinely expensive to construct** — it resolves locale data. Hoisting it to module scope means one instance for the whole app rather than one per card per render. `undefined` locale = the browser's.

**`TRAY_WIDTH` is duplicated as `w-32` in the template** — an unenforced coupling between a JS constant and a Tailwind class.

## The cross-card close effect
```ts
$effect(() => {
  const openId = cardActions.openId;
  if (openId !== note.id) untrack(() => { if (dragX !== 0) dragX = 0; });
});
```
> *"Another card was opened — spring this one closed. Reading and writing `dragX` from one effect made it **re-entrant** on every card in the feed, so the close is folded into `setOpen`'s bookkeeping instead."*

**`untrack()` is the fix.** Without it, the effect *reads* `dragX` (in the `!== 0` test) and *writes* it — so it depends on its own output and re-runs itself, on every card. `untrack` runs the callback without registering dependencies, so only `cardActions.openId` is tracked.

**`const openId = cardActions.openId` on the first line** establishes the dependency before the branch — the same ordering requirement as [`SectionSwipe`](../layout/SectionSwipe.svelte.md)'s effect.

This is the consumer side of [`card-actions.svelte.ts`](../../lib/card-actions.svelte.ts.md)'s single-open pattern.

## `setOpen(open)`
```ts
dragging = false;
dragX = open ? -TRAY_WIDTH : 0;
if (open) cardActions.openId = note.id;
else if (cardActions.openId === note.id) cardActions.openId = null;
```
**The `else if` guard matters:** only clear the shared store if *this* card owns it. Without the check, card A closing would clear card B's open state.

## The drag handlers
```ts
function handleDragMove(dx: number) {
  dragX = dragX === 0
    ? Math.max(-TRAY_WIDTH, Math.min(0, dx))
    : Math.max(-TRAY_WIDTH, Math.min(0, -TRAY_WIDTH + dx));
}
```
**Two branches because the gesture starts from two different resting positions.** Closed (`dragX === 0`) → offset is `dx`. Already open → offset is `-TRAY_WIDTH + dx`, so dragging right closes it. Both clamped to `[-128, 0]` — the card can't overshoot in either direction.

**`handleCommit(direction)`** → `setOpen(direction === "left")`. Left opens, right closes.

**`handleCancel()`** → `setOpen(dragX < -TRAY_WIDTH / 2)` — **snap to whichever half you're nearest**, the standard drawer behaviour for a gesture that didn't cross the velocity/distance threshold.

## `handleFrontClick` — `onclickcapture`
```svelte
onclickcapture={handleFrontClick}
```
```ts
if (dragX !== 0) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
```
**Capture phase is essential.** The card body is an `<a>`; a bubble-phase handler would run *after* the anchor's own default action. Capturing lets it intercept the click on the way down, so **tapping an open card closes the tray instead of navigating**. Only when open — a closed card navigates normally.

## Favourite and delete
`handleFavorite` calls `preventDefault()` + `stopPropagation()` because the button sits inside the `<a>` — without both, favouriting would also navigate. Optimistic `isFav` update, then the DB write, then the parent callback.

`handleDelete` confirms, deletes, `setOpen(false)`, then notifies the parent. Note it closes the tray *before* the parent removes the card — so if the removal is animated, the tray isn't left open mid-flight.

`handleOutsideClick` via `<svelte:window>` closes the tray on any click outside `wrapperEl`.

## Template
- **`{#snippet cardBody()}`** rendered from both branches — the swipeable wrapper and the plain case share one definition.
- **`{#if swipeActions}`** — the tray is opt-in. [`FeedClient`](../feed/FeedClient.svelte.md) passes it; `FeedPage`'s recents carousel doesn't (a swipe there scrolls the carousel).
- **The tray is `absolute inset-y-0 right-0 w-32`, *behind* the card (`z-10` on the front)** — the card slides over a tray that was always there. Simpler than animating the tray in.
- **`!dragging && "transition-transform duration-150"`** — *"Leaving the transition on during the drag restarted a 150ms interpolation on every touchmove, so the card trailed the finger instead of tracking it."* Same insight as `drag-dismiss`'s `transition = "none"`, expressed as a conditional class.
- **`will-change: transform`** — hints the compositor to promote the layer.
- **`note.chords.slice(0, 5)`** and **`note.tags.slice(0, 3)`** — bounded chips so one over-tagged song can't break the grid.
- **`DIFFICULTY_LABEL`** — a *third* copy of this map (also in `NotePage` and `SettingsPage`).
- **`text-white` on the Favorite button** is hardcoded rather than a token, unlike Delete's `text-destructive-foreground`.

**Related:** [`lib/card-actions.svelte.ts`](../../lib/card-actions.svelte.ts.md), [`lib/actions/swipe-horizontal.ts`](../../lib/actions/swipe-horizontal.ts.md), [`components/feed/FeedClient.svelte`](../feed/FeedClient.svelte.md)
