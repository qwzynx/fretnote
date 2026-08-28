# `src/lib/actions/drag-dismiss.ts`

**Role:** A Svelte action: drag a sheet or dialog panel downward to dismiss it.
**Size:** 116 lines. **Depends on:** nothing.

---

## What a Svelte action is

```ts
export function dragDismiss(node: HTMLElement, options: DragDismissOptions) {
  // ...set up on `node`...
  return { update(next) {...}, destroy() {...} };
}
```

Used as `<div use:dragDismiss={{ onDismiss: close }}>`. Svelte calls the function with the real DOM node once it's mounted, and honours the returned object:

- **`update(next)`** — called whenever the options object changes, so the action can pick up new callbacks without being torn down.
- **`destroy()`** — called on unmount. **Cleanup lives here**, and forgetting it leaks listeners per component instance.

Actions are the escape hatch for imperative DOM work that doesn't fit the declarative template model — exactly the case for raw touch handling.

---

## Options

```ts
interface DragDismissOptions {
  onDismiss: () => void;
  threshold?: number;        // px past which release dismisses instead of springing back
  scroller?: () => HTMLElement | null;  // must be scrolled to top before a drag can start
  enabled?: () => boolean;
}
```

**`scroller` and `enabled` are getter functions, not values.** Same reasoning as `historyLayer`'s `isOpen` in [`overlay-history.svelte.ts`](../overlay-history.svelte.ts.md): a function is evaluated *at the moment it's needed*, so it always reads current state. A plain `HTMLElement` captured at setup could be stale (the element may not exist yet when the action runs), and a plain `boolean` would freeze at whatever it was on mount.

`scroller` in particular must be lazy — the scrollable content is often a child that mounts after the action.

---

## The touch-events decision

> *"Uses touch events rather than Pointer Events — the Android WebView commits a touch to native scrolling before a pointer handler gets a chance to claim it, so `touchmove` + manual `preventDefault` is what actually works."*

**Pointer Events are the modern, unified API** and would normally be the right choice. They don't work here: Android's WebView decides a touch belongs to native scrolling before pointer handlers run, so the gesture is stolen. Touch events fire earlier and `preventDefault()` on `touchmove` genuinely cancels the scroll.

A concrete platform constraint driving an "outdated-looking" choice. [`swipe-horizontal.ts`](swipe-horizontal.ts.md) says it's modelled on this file for the same reason.

---

## State

```ts
let opts = options;
let startX = 0, startY = 0;   // where the touch began
let dy = 0;                   // current vertical offset
let dragging = false;         // has the gesture been claimed?
let lastY = 0, lastT = 0;     // previous sample, for velocity
let velocity = 0;             // px per ms
```

**`let opts = options`** — a mutable alias so `update()` can swap it. Closing over the original `options` parameter would leave every handler holding the first object forever, and a callback that changed (a new `onDismiss` after a re-render) would never take effect.

**`dragging` is the gesture-claim flag** and the most important variable. Before it's true, the browser may still scroll; after, the gesture belongs to this action.

---

## `atScrollTop()`

```ts
function atScrollTop(): boolean {
  const scroller = opts.scroller?.();
  return !scroller || scroller.scrollTop <= 0;
}
```

**Resolves the conflict between scrolling and dismissing.** A sheet with a scrollable list inside it has two competing meanings for "drag down": scroll up through the list, or dismiss the sheet. Native apps resolve it by position — dismissal is only available once the content is already at the top.

**`!scroller ||`** — no scroller configured means no constraint. `opts.scroller?.()` handles both a missing option and a getter returning `null`.

**`<= 0`, not `=== 0`** — iOS rubber-band scrolling produces *negative* `scrollTop` during an overscroll bounce. `=== 0` would fail exactly when the user is bouncing at the top, which is the most likely moment to start a dismiss drag.

---

## `reset()`

```ts
function reset() {
  node.style.transition = "";
  node.style.transform = "";
}
```

**Empty strings remove the inline styles**, restoring whatever the stylesheet specifies. Setting `transform: "none"` would instead *override* the CSS with a new inline value. The distinction matters if the sheet has an entry animation in CSS.

---

## `onTouchStart(e)`

```ts
function onTouchStart(e: TouchEvent) {
  if (opts.enabled && !opts.enabled()) return;
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  startX = t.clientX; startY = t.clientY;
  lastY = t.clientY; lastT = e.timeStamp;
  dy = 0;
  dragging = false;
}
```

**`opts.enabled && !opts.enabled()`** — two-stage: is the option provided, and does it say yes. An absent `enabled` means always on.

**`e.touches.length !== 1`** — bail on multi-touch. A two-finger gesture is a pinch-zoom, not a dismiss. Note this *doesn't* reset state, so a second finger landing mid-drag leaves `dragging` true and the next `touchmove` (also multi-touch) bails too — the drag effectively freezes until fingers are lifted, and `touchend` cleans up. Acceptable.

**Nothing is claimed here** — `dragging = false`. `touchstart` only records the origin. The decision to claim the gesture is deferred to the first `touchmove`, which is the only place there's enough information to make it.

**`e.timeStamp`, not `Date.now()`** — the event's own timestamp is what the browser recorded when the input occurred, so it isn't skewed by handler latency. More accurate for velocity.

**The listener is `{ passive: true }`** (see registration below) — `touchstart` never calls `preventDefault`, so telling the browser that up front lets it start scrolling without waiting on this handler.

---

## `onTouchMove(e)` — where the gesture is decided

```ts
const curDy = t.clientY - startY;
const curDx = t.clientX - startX;

if (!dragging) {
  const isDownwardVerticalDrag = curDy > 8 && Math.abs(curDy) > Math.abs(curDx);
  if (!isDownwardVerticalDrag || !atScrollTop()) return;
  dragging = true;
  node.style.transition = "none";
}

e.preventDefault();
dy = Math.max(0, curDy);
const dt = e.timeStamp - lastT;
if (dt > 0) velocity = (t.clientY - lastY) / dt;
lastY = t.clientY;
lastT = e.timeStamp;

node.style.transform = `translateY(${dy}px)`;
```

### The claim condition

**`curDy > 8`** — an 8-pixel deadzone. Below it the touch could be a tap, a tremor, or the start of a scroll. Claiming immediately would make every tap feel like a failed drag.

**Deliberately not `Math.abs(curDy) > 8`** — only *downward* movement qualifies. Dragging up is scrolling, never dismissing.

**`Math.abs(curDy) > Math.abs(curDx)`** — the direction test. More vertical than horizontal, so a diagonal resolves to whichever axis dominates. This is what lets this action coexist with [`swipe-horizontal.ts`](swipe-horizontal.ts.md) on overlapping elements: each claims its own axis and the first few pixels decide.

**`|| !atScrollTop()`** — evaluated only after the shape test passes, so the (slightly expensive) `scrollTop` read is skipped on non-qualifying moves.

**`return` without claiming** leaves `dragging` false, so the browser handles the touch normally. **Crucially, `preventDefault` is not called**, so native scrolling proceeds. The action opts out cleanly.

**Once claimed** the check is skipped for the rest of the gesture — a drag that starts downward stays a drag even if the finger then moves sideways or back up. That's the right feel: the user has committed.

**`node.style.transition = "none"`** on claim — disables any CSS transition so the panel tracks the finger with zero lag. Restored in `onTouchEnd` for the release animation.

### The move body

**`e.preventDefault()`** — cancels native scrolling. **This is the line that requires `{ passive: false }`** on the listener; in a passive listener the call is ignored with a console warning.

**`dy = Math.max(0, curDy)`** — clamps to non-negative. Once dragging, pulling back *above* the start point pins the panel at its resting position rather than lifting it off-screen. So a user who overshoots and drags back up sees the sheet return to place and stop, which is what a native sheet does.

**`if (dt > 0)`** — guards a division by zero. Two events can share a `timeStamp` (coalesced touch samples), and `dx / 0` gives `Infinity`, which would trip the velocity threshold and dismiss on a stationary finger.

**Velocity is instantaneous, not averaged** — computed from the last two samples only. Simple, and it responds to a flick at the very end of a slow drag, which is exactly the gesture users make. The cost is jitter, which the generous `0.5 px/ms` threshold absorbs.

**`translateY`, not `top`** — a compositor-only property. Animating `top` triggers layout on every frame; `transform` doesn't.

---

## `dismissTimer` and `onTouchEnd()`

```ts
/** Tracked so teardown can cancel it — otherwise the dismiss callback
 *  fires after the component is gone. */
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function onTouchEnd() {
  if (!dragging) return;
  dragging = false;
  const threshold = opts.threshold ?? 96;
  if (dy > threshold || velocity > 0.5) {
    node.style.transition = "transform 160ms ease-in";
    node.style.transform = "translateY(100%)";
    dismissTimer = setTimeout(() => {
      dismissTimer = null;
      reset();
      opts.onDismiss();
    }, 160);
  } else {
    node.style.transition = "transform 200ms ease-out";
    node.style.transform = "translateY(0px)";
  }
  dy = 0;
  velocity = 0;
}
```

**`if (!dragging) return`** — an unclaimed touch (a tap) does nothing. Also makes the handler safe to bind to both `touchend` and `touchcancel`.

### The commit condition — distance **or** velocity

```ts
if (dy > threshold || velocity > 0.5)
```

**Two independent ways to dismiss**, and having both is what makes the gesture feel right:

- **`dy > 96`** — a slow, deliberate drag past ~96px.
- **`velocity > 0.5` px/ms** (500 px/s) — a quick flick, however short. Without this, a fast downward flick of 40px would spring back, which feels broken.

**`velocity > 0.5`, not `Math.abs(velocity)`** — direction matters. A fast *upward* flick at the end of a long drag should cancel, not dismiss. Compare `swipe-horizontal.ts`, which uses `Math.abs` because either direction is a valid commit there.

**`opts.threshold ?? 96`** — `??` not `||`, so a caller could pass `0` to make any drag dismiss.

### The two animations

**Dismiss** — `160ms ease-in`, `translateY(100%)`. Slides the panel fully off its own height. `ease-in` accelerates, so it reads as "leaving."

**Cancel** — `200ms ease-out`, `translateY(0px)`. Slower and decelerating, so it reads as "settling back." The asymmetry is deliberate: departures are quick, returns are gentle.

### The timer

**`setTimeout(..., 160)` matches the transition duration** — `onDismiss()` fires only after the panel is visually gone. Calling it immediately would unmount the component mid-animation and the sheet would vanish rather than slide.

**A `transitionend` listener would be more robust** (it can't drift out of sync with the CSS), but needs its own cleanup and can fail to fire if the transition is interrupted. The hardcoded duplicate of `160` is the pragmatic choice — just remember that changing one number requires changing both.

**`dismissTimer = null` as the first line of the callback** — clears the handle before doing anything, so `destroy()` can't later try to cancel an already-fired timer.

**`reset()` before `onDismiss()`** — strips the inline `translateY(100%)`. Without it, a component that's reused rather than destroyed would reappear already translated off-screen. Order matters: `onDismiss` may unmount the node.

**`dy = 0; velocity = 0`** at the end — reset for the next gesture, in both branches.

---

## Registration and teardown

```ts
node.addEventListener("touchstart",  onTouchStart, { passive: true  });
node.addEventListener("touchmove",   onTouchMove,  { passive: false });
node.addEventListener("touchend",    onTouchEnd,   { passive: true  });
node.addEventListener("touchcancel", onTouchEnd,   { passive: true  });
```

**The `passive` flags are load-bearing, not decoration.**

`{ passive: true }` promises the handler won't call `preventDefault()`, letting the browser scroll without waiting for it — a real scroll-performance win. `touchmove` is `{ passive: false }` precisely because it *does* call `preventDefault()`; marking it passive would silently break the entire gesture with only a console warning.

**`touchcancel` shares `onTouchEnd`.** It fires when the system takes over the touch — an incoming call, a system gesture, too many fingers. Treating it as a release means the panel springs back or dismisses rather than freezing mid-drag with an inline transform stuck on it. Easy to omit and a real bug when you do.

```ts
destroy() {
  node.removeEventListener("touchstart", onTouchStart);
  ...
  if (dismissTimer !== null) clearTimeout(dismissTimer);
  reset();
}
```

**Three cleanup responsibilities:**

1. **Remove all four listeners.** They're bound to a node that's being removed, but a stale reference would keep the closure — and its `opts` — alive.
2. **`clearTimeout(dismissTimer)`** — the reason the handle is tracked at all, per the comment. Without it, dismissing and then having the component unmount within 160ms fires `onDismiss()` on a dead component. That callback typically writes to component state, producing an error or a phantom state change.
3. **`reset()`** — strips inline styles from a node that may be reused.

**Note `removeEventListener` is called without the options object.** Only `capture` participates in listener matching, not `passive`, so this correctly removes them.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `opts.enabled && !opts.enabled()` | start, move | Absent option ⇒ always on |
| `e.touches.length !== 1` | start, move | Multi-touch is a pinch, not a drag |
| `scrollTop <= 0` not `=== 0` | `atScrollTop` | iOS rubber-band produces negative values |
| `curDy > 8` (not `abs`) | move | 8px deadzone, downward only |
| `abs(curDy) > abs(curDx)` | move | Axis arbitration — lets horizontal swipe coexist |
| `return` without `preventDefault` | move | Cleanly hand the touch back to the browser |
| `if (!dragging)` claim, then skip | move | A committed gesture stays committed |
| `transition = "none"` on claim | move | Zero-lag finger tracking |
| `Math.max(0, curDy)` | move | Pin at rest when dragged back up |
| `if (dt > 0)` | move | Coalesced samples ⇒ division by zero ⇒ `Infinity` |
| `dy > threshold \|\| velocity > 0.5` | end | Slow drag **or** quick flick |
| `velocity > 0.5` (not `abs`) | end | An upward flick must cancel, not dismiss |
| `?? 96` not `\|\| 96` | end | Allow a caller to pass `0` |
| `setTimeout(160)` = transition duration | end | Fire `onDismiss` after the panel is gone |
| `reset()` before `onDismiss()` | end | Strip the off-screen transform first |
| `{ passive: false }` on `touchmove` only | registration | Required for `preventDefault` to work |
| `touchcancel` → `onTouchEnd` | registration | System interruptions must not freeze the panel |
| `clearTimeout` in `destroy` | teardown | Don't call `onDismiss` on an unmounted component |

---

## Related

- [`lib/actions/swipe-horizontal.ts`](swipe-horizontal.ts.md) — the sibling action, same structure, horizontal axis
- [`lib/overlay-history.svelte.ts`](../overlay-history.svelte.ts.md) — `onDismiss` typically routes through `dismiss()` there
- [`components/ui/Popover.svelte`](../../components/ui/Popover.svelte.md), [`AddToSetlistDialog.svelte`](../../components/ui/AddToSetlistDialog.svelte.md) — consumers
- [`lib/media.svelte.ts`](../media.svelte.ts.md) — `isTouch`, often wired to `enabled`
