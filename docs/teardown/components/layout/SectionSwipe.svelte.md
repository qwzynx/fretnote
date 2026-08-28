# `src/components/layout/SectionSwipe.svelte`
**Role:** On phones, mounts the three section pages side by side in one track so swiping shows the neighbour sliding in live. **118 lines.**

> *"the three bottom-nav sections are mounted side by side in a single track (rather than routed one-at-a-time) so a drag can show the neighboring page sliding in **in real time**, like a native paged tab view, instead of the old slide-out/slide-in-after-navigation two-step."*

**This is why three pages mount at once** — and therefore why [`db-driver.ts`](../../lib/db-driver.ts.md) had to cache the init *promise* rather than the driver. That comment's *"on phones three section pages mount at once"* is this file.

## Derived state
```ts
const idx = $derived(sectionIndex(router.location));
const onSection = $derived(idx !== -1);
const showCarousel = $derived(isPhone.current && onSection);
```
`sectionIndex` returns `-1` for anything that isn't a section root — which is exactly the "is this swipeable?" test [`sections.ts`](../../lib/sections.ts.md) was designed for. **On desktop, or on any non-section route, the whole mechanism is bypassed** and `{@render children()}` renders the Router normally.

## `place(atIdx, dragPx)`
```ts
trackEl.style.transform = `translateX(calc(${-atIdx * 100}% + ${dragPx}px))`;
```
**Mixing `%` and `px` in one `calc`** — the percentage snaps to whole pages, the pixels track the finger. That combination is the whole positioning model.

## The settling `$effect`
```ts
$effect(() => {
  const i = idx;
  if (i === -1 || dragging || !trackEl) return;
  trackEl.style.transition = SETTLE_TRANSITION;
  place(i, 0);
});
```
**`const i = idx` on the first line establishes `idx` as a tracked dependency** before any early return — read it after the `if` and the effect would not re-run when the route changes. A subtle but real ordering requirement in Svelte's dependency tracking.

**`|| dragging`** — the effect must not fight the drag handlers for control of the transform. It only acts when at rest, which covers both a bottom-nav tap and the route reconciliation after a commit.

## Drag handlers
- **`handleDragStart`** — `transition = "none"` for zero-lag tracking (same as [`drag-dismiss`](../../lib/actions/drag-dismiss.ts.md)).
- **`handleDragMove`** — `atStart`/`atEnd` guards apply `dx * 0.35` **rubber-band resistance** at the ends instead of blocking. Compare [`SetlistPage`](../../pages/SetlistPage.svelte.md), which blocks entirely; here the track still moves a little, which reads as "nothing over there" without feeling broken.
- **`handleCommit`** — bounds-checks `nextIdx`, then **`settle(nextIdx)` *before* `goto(...)`**. The comment explains: *"The track is already mid-flight toward `nextIdx`; `goto()` just reconciles the route/hash underneath it, so the motion never stalls to swap DOM."* Because all three pages are already mounted, the route change is bookkeeping — no remount, no stutter.
- **`handleCancel`** — settles back to `idx`.

## Template
- **`enabled: () => isPhone.current && overlayDepth() === 0`** — **the `overlayDepth()` check is the important half**: with a dialog or sheet open, a horizontal drag must not page the background. See [`overlay-history.svelte.ts`](../../lib/overlay-history.svelte.ts.md).
- **`overflow-hidden` wrapper + `flex` track + `w-full shrink-0` panes** — the classic carousel: three full-width panes in a row, clipped to one.
- **`aria-hidden={i !== idx}` and `inert={i !== idx}`** — off-screen pages are hidden from assistive tech *and* `inert` removes them from the tab order and blocks all interaction. **Without `inert`, tabbing would walk invisibly into the Settings page while you're on the feed.** Two attributes because they cover different concerns.
- **Each pane owns its own `overflow-y-auto overscroll-contain pb-navbar`** — independent scroll positions per section, preserved across swipes. That's a real benefit of keeping them mounted.
- **`style="transform: translateX({-idx * 100}%)"`** sets the initial position declaratively; the handlers then take over imperatively.
- **`{#each … (i)}`** — index-keyed, correct for a fixed-length list that never reorders.
- **`SETTLE_TRANSITION`** hardcodes `280ms cubic-bezier(0.22, 1, 0.36, 1)` — which is exactly `--duration-slow` and `--ease-settle` from [`globals.css`](../../app/globals.css.md). That file's comment says this curve was *promoted* from here to become the app default; the constant remains a literal because it's set from JS.

**Related:** [`lib/sections.ts`](../../lib/sections.ts.md), [`lib/actions/swipe-horizontal.ts`](../../lib/actions/swipe-horizontal.ts.md), [`lib/db-driver.ts`](../../lib/db-driver.ts.md), [`BottomNav.svelte`](BottomNav.svelte.md)
