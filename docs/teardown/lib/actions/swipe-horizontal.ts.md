# `src/lib/actions/swipe-horizontal.ts`

**Role:** A Svelte action that detects an intentional horizontal drag and reports its progress via callbacks, leaving the caller to apply any visual transform.
**Size:** 123 lines. **Depends on:** nothing.

> *"Modeled on `drag-dismiss.ts` — touch events rather than Pointer Events, since Android WebView commits a touch to native scrolling before a pointer handler gets a chance to claim it."*

**Read [`drag-dismiss.ts`](drag-dismiss.ts.md) first.** The structure is identical — same state variables, same claim-on-first-move pattern, same `passive` flags, same `touchcancel` handling. This file documents the *differences*, which are the interesting part.

---

## The key architectural difference: it renders nothing

`drag-dismiss` sets `node.style.transform` itself. This action never touches the DOM's appearance — it only calls back:

```ts
onDragStart?: () => void;
onDragMove?: (dx: number, velocity: number) => void;
onCommit?: (direction: "left" | "right", velocity: number) => void;
onCancel?: () => void;
```

**Why:** `drag-dismiss` has exactly one job — move this panel down. Horizontal swipes serve two very different consumers:

- [`SectionSwipe.svelte`](../../components/layout/SectionSwipe.svelte.md) — a **carousel** where the whole page tracks the finger and commit means "change section."
- [`NoteCard.svelte`](../../components/notes/NoteCard.svelte.md) — a **swipe-to-reveal tray** where the card moves a bounded distance and commit means "open the action tray."

Those need different transforms, different clamping, different easing. A single action can't own all that. So this one detects the *gesture* and hands over raw numbers; the caller owns the *presentation*.

**The tradeoff:** every consumer duplicates transform code. In exchange, one gesture detector serves both.

---

## Options unique to this file

```ts
edgeGate?: number;                        // touch must start within N px of the left edge
directions?: "left" | "right" | "both";
distanceThreshold?: number;               // default 80
velocityThreshold?: number;               // default 0.5
```

**`edgeGate`** — *"Touch must start within this many px of the node's left edge. Omit for no edge gate."*

This is the **iOS/Android back-gesture convention**. A back-swipe must start at the screen edge; otherwise every left-to-right drag anywhere on the page would trigger navigation, making horizontally-scrollable content (a wide tab block, a chip row) unusable. Restricting to the edge reserves the middle of the screen for content.

**`directions`** — restricts which way counts. A back-gesture is `"right"` only (dragging rightward goes back); a section carousel is `"both"`.

**Both thresholds are exposed** here but hardcoded in `drag-dismiss` — because a card tray (short travel) and a full-page carousel (long travel) want different commit distances.

---

## The three helpers

```ts
function withinEdgeGate(x: number): boolean {
  if (opts.edgeGate == null) return true;
  const rect = node.getBoundingClientRect();
  return x - rect.left <= opts.edgeGate;
}
```

**`== null`** — loose equality, deliberately. It matches both `null` and `undefined` in one check while *not* matching `0`. With `!opts.edgeGate`, an `edgeGate` of `0` would disable the gate entirely rather than making it maximally strict. One of the few places loose `==` is the correct tool.

**`getBoundingClientRect()` is called per touch, not cached** — the node's position changes with scroll, resize, and orientation. A cached rect would let the gate drift.

**`x - rect.left`** — distance from the *node's* left edge, not the viewport's. So the gate is relative to whatever element the action is on.

```ts
function directionOf(dx: number): "left" | "right" {
  return dx < 0 ? "left" : "right";
}

function directionAllowed(dir: "left" | "right"): boolean {
  const allowed = opts.directions ?? "both";
  return allowed === "both" || allowed === dir;
}
```

**`dx < 0` is "left"** — negative x means the finger moved leftward. Note `dx === 0` reports `"right"`, which never matters because the caller has already cleared an 8px deadzone.

**`?? "both"`** — default when unspecified.

---

## `armed` — the extra state variable

```ts
let armed = false;
```

**This is the one structural addition over `drag-dismiss`.** It records whether the touch *started* in a legal place, decided once at `touchstart`:

```ts
armed = withinEdgeGate(startX);
```

and checked first on every move:

```ts
function onTouchMove(e: TouchEvent) {
  if (!armed) return;
  ...
}
```

**Why a separate flag rather than re-checking the gate on each move:** the gate is about the touch's **origin**, not its current position. A back-swipe starts at the edge and travels to the middle of the screen — by the second move event the finger is well past `edgeGate`, and re-checking would abort the gesture immediately. Latching the decision at `touchstart` is the only correct way to express "started at the edge."

**Cleared in `onTouchEnd`** (`armed = false`) rather than at the start of the next `touchstart` — so a touch that never produced a move still disarms.

---

## The other unique guard

```ts
if ((e.target as HTMLElement).closest("[data-no-swipe-nav]")) return;
```

**An opt-out escape hatch, in `onTouchStart`.** Any element can mark a subtree as swipe-immune:

```svelte
<div data-no-swipe-nav>
  <!-- a horizontal fret slider, a wide tab block, a carousel -->
</div>
```

**`closest()` walks up the ancestor chain** from the touch target, so the attribute protects an entire subtree rather than only the exact element touched. That matters — the actual `e.target` is usually a deeply nested leaf.

**Why an attribute rather than a prop:** the action is applied to a *container* (the page root), while the elements needing protection are arbitrarily deep inside unrelated components. There's no prop path between them. A DOM attribute is the only channel that crosses that distance without threading state through every intermediate component.

**Note this is checked at `touchstart` and never re-evaluated** — same latching logic as `armed`.

`drag-dismiss` has no equivalent because its `atScrollTop()` check already handles the analogous conflict (scrollable content inside a sheet).

---

## `onTouchMove` — the mirrored claim condition

```ts
if (!dragging) {
  const isHorizontalDrag = Math.abs(curDx) > 8 && Math.abs(curDx) > Math.abs(curDy);
  if (!isHorizontalDrag || !directionAllowed(directionOf(curDx))) return;
  dragging = true;
  opts.onDragStart?.();
}
```

**Compare `drag-dismiss`:**

```ts
const isDownwardVerticalDrag = curDy > 8 && Math.abs(curDy) > Math.abs(curDx);
```

**The axis test is exactly mirrored** — `abs(dx) > abs(dy)` here, `abs(dy) > abs(dx)` there. **This is the arbitration mechanism** that lets both actions live on overlapping elements: within the first 8 pixels, whichever axis dominates claims the gesture, and the loser silently declines without calling `preventDefault`. Neither action knows the other exists.

**`Math.abs(curDx) > 8`, not `curDx > 8`** — the deadzone is symmetric here because both directions can be valid, whereas `drag-dismiss` only accepts downward.

**`directionAllowed(...)` is part of the claim**, so a leftward drag on a right-only gate never claims the gesture at all — native scrolling continues undisturbed. Checking direction only at commit time would swallow the touch and then do nothing, which feels broken.

**`opts.onDragStart?.()` instead of `node.style.transition = "none"`** — the same moment in the lifecycle, but delegated. The caller typically disables its own transition here.

**`opts.onDragMove?.(curDx, velocity)` passes the raw delta**, unclamped — no `Math.max(0, ...)` as in `drag-dismiss`. Clamping is presentation, and presentation belongs to the caller. `SectionSwipe` applies rubber-band resistance at the ends; `NoteCard` clamps to the tray width. Neither could do that from a pre-clamped value.

---

## `onTouchEnd` — commit or cancel

```ts
function onTouchEnd(e: TouchEvent) {
  armed = false;
  if (!dragging) return;
  dragging = false;
  const dx = lastX - startX;
  const distanceThreshold = opts.distanceThreshold ?? 80;
  const velocityThreshold = opts.velocityThreshold ?? 0.5;
  const dir = directionOf(dx);

  if (directionAllowed(dir) && (Math.abs(dx) > distanceThreshold || Math.abs(velocity) > velocityThreshold)) {
    opts.onCommit?.(dir, velocity);
  } else {
    opts.onCancel?.();
  }
  velocity = 0;
}
```

**`armed = false` before the `dragging` guard** — so it's cleared even for a touch that never became a drag.

**`const dx = lastX - startX`** — recomputed from the last recorded sample rather than read from the event. `touchend` has an empty `touches` list (the finger is gone), so the final position must come from stored state. `drag-dismiss` keeps a running `dy` instead; same idea, different bookkeeping.

**`Math.abs(velocity) > velocityThreshold`** — absolute, unlike `drag-dismiss`'s directional `velocity > 0.5`. Correct in both cases: there, only downward dismisses; here, a fast flick either way is a valid commit, and `directionOf(dx)` reports which.

**`directionAllowed(dir)` re-checked at commit** — belt and braces. The claim already enforced it, but a drag that starts rightward and ends net-leftward would otherwise commit in a forbidden direction.

**Distance OR velocity**, same as `drag-dismiss` and for the same reason: a short fast flick must work.

**Both callbacks are optional** (`?.()`), so a consumer that only cares about commit can omit `onCancel`.

**Note there's no `dismissTimer` and no `clearTimeout` in `destroy()`** — because this action schedules nothing. All animation timing belongs to the caller, so there's no pending work to cancel. That's the one place the delegated design makes teardown *simpler*.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `opts.edgeGate == null` (loose) | `withinEdgeGate` | Matches null/undefined but **not** `0` |
| `getBoundingClientRect()` per touch | `withinEdgeGate` | The node moves with scroll and resize |
| `closest("[data-no-swipe-nav]")` | start | Subtree opt-out across component boundaries |
| `armed = withinEdgeGate(startX)` | start | Latch the *origin* — the finger travels past the gate |
| `if (!armed) return` | move | The gate is about where it started, not where it is |
| `abs(curDx) > 8 && abs(curDx) > abs(curDy)` | move | Mirrored axis test — arbitration with `drag-dismiss` |
| `directionAllowed` in the **claim** | move | Decline early so native scrolling is undisturbed |
| raw `curDx` to `onDragMove` | move | Clamping is presentation; the caller owns it |
| `dx = lastX - startX` | end | `touchend` has no touches — use stored state |
| `Math.abs(velocity)` (not directional) | end | Either direction is a valid commit here |
| `directionAllowed` re-checked | end | A drag can end net-opposite to how it started |
| `armed = false` before the guard | end | Clear even for touches that never dragged |
| no timer, no `clearTimeout` | teardown | Nothing is scheduled — animation is the caller's |

---

## The two actions side by side

| | `drag-dismiss` | `swipe-horizontal` |
|---|---|---|
| Axis | Vertical (down only) | Horizontal (configurable) |
| Applies transform | **Yes**, itself | **No**, via callbacks |
| Deadzone | `curDy > 8` | `abs(curDx) > 8` |
| Axis test | `abs(dy) > abs(dx)` | `abs(dx) > abs(dy)` |
| Extra gate | `atScrollTop()` | `edgeGate` + `data-no-swipe-nav` |
| Commit velocity | `velocity > 0.5` (directional) | `abs(velocity) > 0.5` |
| Animation | Owns it (`setTimeout`) | Caller's |
| Teardown | Listeners + timer + styles | Listeners only |

**The mirrored axis tests are the contract between them.** Both can be attached to overlapping elements, and the first 8 pixels of movement decide which one claims the gesture. Neither imports the other; the arbitration is emergent from the symmetric conditions.

---

## Related

- [`lib/actions/drag-dismiss.ts`](drag-dismiss.ts.md) — the sibling this is modelled on
- [`components/layout/SectionSwipe.svelte`](../../components/layout/SectionSwipe.svelte.md) — carousel consumer, `directions: "both"`
- [`components/notes/NoteCard.svelte`](../../components/notes/NoteCard.svelte.md) — swipe-to-reveal tray
- [`lib/nav-stack.svelte.ts`](../nav-stack.svelte.ts.md) — where a committed back-swipe lands
- [`lib/sections.ts`](../sections.ts.md) — the section order a carousel swipe moves through
