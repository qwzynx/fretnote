# `src/lib/overlay-history.svelte.ts`

**Role:** Backs every dismissible overlay (sheet, dialog, popover) with a real browser history entry, so the Android back button unwinds overlays before it navigates or exits the app.
**Size:** 140 lines. **Depends on:** nothing.

**One of the two hardest files in the codebase.** Read it together with [`nav-stack.svelte.ts`](nav-stack.svelte.ts.md) — they cooperate through a single `popstate` listener that lives here.

---

## The problem

On Android, the hardware back button fires `popstate`. A user with a dialog open presses back and expects the **dialog** to close. Without intervention, back navigates the route — or exits the app entirely — while the dialog is still on screen.

The fix: **every open overlay owns a history entry.** Opening pushes one; back pops it and closes the overlay instead of navigating. Overlays stack, so backing out unwinds them one at a time in the right order.

The difficulty is that history is a *global, asynchronous* resource shared with the router, and overlays open and close by many routes (a button, an outside click, Escape, a drag gesture, the back button itself). Keeping the two in sync is what the whole file is about.

---

## `Layer` and module state

```ts
interface Layer {
  close: () => void;
  /** Set once this layer has been consumed by a real popstate (back button/gesture),
      so the component's own effect cleanup doesn't try to unwind history a second time. */
  popped: boolean;
}

const layers: Layer[] = [];
let suppressed = 0;
const pendingAfterPop: Array<() => void> = [];
let fallback: (() => void) | null = null;
```

**`layers`** — a stack (`push`/`pop`), mirroring the visual z-order. Last in is topmost.

**`popped` is the double-unwind guard**, and it's the crux of the file. A layer can be torn down two ways:

1. **Back button** → `popstate` fires → this module pops the layer and calls its `close()`.
2. **Anything else** (X button, Escape, outside click) → the component's state flips → its `$effect` cleanup runs → `releaseLayer` calls `history.back()` to unwind the entry.

Path 1 already consumed the history entry. But it also calls `close()`, which flips the component's state, which triggers the *same* `$effect` cleanup — which would then call `history.back()` **again**, popping an entry that isn't ours. That's a second, unwanted navigation: the route changes, or the app exits.

`popped: true` is set in path 1 so the cleanup in path 2 sees it and skips the `history.back()`. **The two paths converge on the same cleanup code and the flag tells them apart.**

**`suppressed`** — a counter of `popstate` events this module *caused* itself, which must not be interpreted as user back-presses. Programmatic `history.back()` and `history.go(-n)` are indistinguishable from a real back press when the event arrives, so intent has to be tracked out of band.

**`pendingAfterPop`** — a queue of callbacks to run once a programmatic pop actually lands. History navigation is **asynchronous** — `history.back()` returns immediately and the `popstate` arrives later — so "close this, then navigate" has to be sequenced through this queue.

**`fallback`** — the hook `nav-stack` registers. See below.

---

## `setPopstateFallback(fn)` — the coordination point

```ts
export function setPopstateFallback(fn: (() => void) | null) {
  fallback = fn;
}
```

> *"Registers a callback for popstate events that aren't consumed by any dialog layer — used by the nav-stack module so **a single listener** decides, per event, whether a dialog or the reduced route hierarchy reacts."*

**Why a single listener matters.** If both modules added their own `window.addEventListener("popstate", ...)`, both would run on every event. Back with a dialog open would close the dialog *and* navigate the route. Listener order isn't a contract you want to depend on.

So this module owns the only listener and offers a fallback slot. The precedence is explicit and readable in `handlePopState`: **suppression → layers → fallback.** Overlays always win; routing only sees events no overlay claimed.

`null` clears it, which `initNavStack`'s cleanup uses.

---

## `handlePopState()` — the three-way dispatch

```ts
function handlePopState() {
  if (suppressed > 0) {
    suppressed -= 1;
    pendingAfterPop.shift()?.();
    return;
  }
  const layer = layers.pop();
  if (layer) {
    layer.popped = true;
    layer.close();
    return;
  }
  fallback?.();
}
```

**Priority 1 — a pop we caused.**

`suppressed -= 1` consumes one. `pendingAfterPop.shift()?.()` dequeues and runs the paired callback, if any — FIFO, matching the order they were queued. The `?.()` handles a suppression queued without a callback.

**Nothing else happens** — no layer is popped (it was already removed by `releaseLayer`) and the fallback isn't called. This branch exists purely to *absorb* the event.

**Priority 2 — a real back press with an overlay open.**

`layers.pop()` removes and returns the top layer. **`popped = true` is set *before* `close()`** — and the order is essential. `close()` synchronously flips the component's state, which synchronously runs its `$effect` cleanup, which calls `releaseLayer`, which reads `popped`. Setting the flag after `close()` would be too late: the cleanup would already have fired a second `history.back()`.

**Priority 3 — no overlay.**

`fallback?.()` hands the event to `nav-stack`'s `handleNavPop`. The optional call covers the window before `initNavStack` runs.

---

## `initOverlayHistory()`

```ts
export function initOverlayHistory(): () => void {
  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}
```

**Returns its own cleanup** — the standard Svelte `onMount` contract. `App.svelte` calls it once and returns the cleanup from its `onMount`, so the listener is added and removed with the app root.

---

## `overlayDepth()` and `closeTopLayer()`

```ts
export function overlayDepth(): number { return layers.length; }

export function closeTopLayer(): boolean {
  const layer = layers[layers.length - 1];
  if (!layer) return false;
  layer.close();
  return true;
}
```

**`closeTopLayer` is what `App.svelte`'s Escape handler calls**, and its **boolean return is the whole interface**:

```ts
if (e.key === "Escape") {
  if (!closeTopLayer()) window.history.back();
}
```

`true` = an overlay was closed, so Escape is consumed. `false` = nothing was open, so fall through to browser-back. One function answering both "is anything open?" and "close it."

**It peeks rather than pops** — `layers[length - 1]`, not `layers.pop()`. Deliberate: it calls `close()`, which flips component state, which triggers the `$effect` cleanup, which calls `releaseLayer`, which does the actual removal *and* the `history.back()`. Popping here would leave a stray history entry behind. **The removal must go through `releaseLayer` so the history side stays balanced.**

`overlayDepth()` is a read-only probe for components that need to know whether anything is stacked above them.

---

## `pushLayer(close)`

```ts
function pushLayer(close: () => void): Layer {
  const layer: Layer = { close, popped: false };
  layers.push(layer);
  // Same-hash entry: doesn't fire `hashchange`, so svelte-spa-router never sees it.
  history.pushState({ fretnoteLayer: true }, "");
  return layer;
}
```

**`history.pushState(state, "")` with no URL argument** — this is the key trick. Omitting the third parameter keeps the current URL exactly as it is, so the new entry has the **same hash** as the previous one.

**Why that matters:** the app uses `svelte-spa-router`, which routes on `hashchange`. A same-hash `pushState` fires no `hashchange`, so **the router never learns this entry exists.** Opening a dialog adds a history entry that back can consume, without the router thinking a navigation happened. Pushing `#/dialog` instead would trigger a route change and a re-render.

**`{ fretnoteLayer: true }`** — a marker in the history state object. Not read anywhere in this file; it's for debugging (visible in `history.state`) and to distinguish these from `nav-stack`'s `{ fretnoteNav: true }` markers.

---

## `releaseLayer(layer, then?)` — the non-back path

```ts
function releaseLayer(layer: Layer, then?: () => void) {
  if (layer.popped) {
    then?.();
    return;
  }
  const idx = layers.indexOf(layer);
  if (idx !== -1) layers.splice(idx, 1);
  layer.popped = true;
  suppressed += 1;
  if (then) pendingAfterPop.push(then);
  history.back();
}
```

**`if (layer.popped)` — the double-unwind guard firing.** The back button already consumed this layer's entry, so there's nothing to unwind. Run `then` and stop. **Without this line, every back-button dismissal would fire a second `history.back()`** and navigate away from the page.

**`indexOf` + `splice`, not `pop`.** Layers don't always close top-down — a component deeper in the stack can unmount for unrelated reasons (a route change, a parent re-render), and removing it must not disturb the ones above.

Note the *history* side is still LIFO: `history.back()` pops the most recent entry regardless of which layer object was spliced out. If a non-top layer releases, the counts stay balanced but the entry consumed belongs to a different layer. A latent inconsistency that doesn't bite in practice because overlays here do close top-down.

**`if (idx !== -1)`** — guards a double-release.

**`suppressed += 1` *before* `history.back()`** — must be. The resulting `popstate` will arrive later and find `suppressed > 0`, so `handlePopState` absorbs it instead of popping another layer. Setting it after would be a race in principle; in practice `popstate` is always a later task, but the ordering is correct as written.

**`pendingAfterPop.push(then)`** — queued so it runs when the pop lands, not now.

---

## `closeAllLayers(then?)`

```ts
export function closeAllLayers(then?: () => void) {
  const toClose = layers.splice(0, layers.length);
  if (toClose.length === 0) { then?.(); return; }
  // Browsers coalesce a multi-step history.go(-N) into a single popstate,
  // not N separate ones, so only one suppression/callback is queued here.
  suppressed += 1;
  if (then) pendingAfterPop.push(then);
  for (let i = toClose.length - 1; i >= 0; i--) {
    toClose[i].popped = true;
    toClose[i].close();
  }
  history.go(-toClose.length);
}
```

> *"Closes every open layer at once (e.g. an editor 'Cancel' leaving the page)."*

**`layers.splice(0, layers.length)`** — empties the array *and* returns its contents, in one call. Emptying first means the `close()` calls below can't re-enter and find a stale stack.

**The comment documents a real browser behaviour**, and it's the single most important line in the function:

> *"Browsers coalesce a multi-step `history.go(-N)` into a **single** popstate, not N separate ones, so only one suppression/callback is queued here."*

`history.go(-3)` fires **one** `popstate`, not three. So `suppressed += 1`, not `+= toClose.length`. Getting this wrong in either direction breaks the app: too many suppressions and later real back-presses get silently swallowed; too few and the collapse is mistaken for a user back-press.

**The reverse loop (`i = length - 1; i >= 0; i--`)** closes top-down — the topmost overlay first. Visually correct (dialogs disappear from the front), and it matches the order the user would have closed them by hand.

**`popped = true` before each `close()`** — same reasoning as `handlePopState`. Each `close()` triggers a component cleanup that calls `releaseLayer`; the flag makes each one a no-op so no extra `history.back()` fires. **This is what makes a single `go(-N)` correct** — without the flags you'd get one `go(-N)` plus N stray `back()` calls.

**`history.go(-toClose.length)`** — unwind all their entries in one navigation.

---

## `historyLayer(isOpen, close)` — the component-facing API

```ts
export function historyLayer(isOpen: () => boolean, close: () => void) {
  let layer: Layer | null = null;

  $effect(() => {
    if (isOpen()) {
      layer = pushLayer(close);
      return () => {
        if (layer) releaseLayer(layer);
        layer = null;
      };
    }
  });

  function dismiss(then?: () => void) { ... }

  return { dismiss };
}
```

The only export a component touches. Usage:

```svelte
const { dismiss } = historyLayer(() => open, () => (open = false));
```

### The `$effect`

**`isOpen` is a getter function, not a boolean.** That's what makes it reactive: calling `isOpen()` *inside* the effect registers a dependency on whatever `$state` it reads, so the effect re-runs whenever the component's open flag changes. Passing `open` directly would capture a snapshot at call time and never update.

**`return () => {...}` is the effect's cleanup**, and Svelte's semantics do the work: the returned function runs before the effect re-runs *and* when the component unmounts. So:

- `isOpen()` false → true: effect runs, pushes a layer.
- true → false: **cleanup runs**, releasing the layer. Then the effect body runs again, `isOpen()` is false, nothing happens.
- unmount while open: cleanup runs, releasing the layer.

**The cleanup is only returned from inside the `if`.** When `isOpen()` is false the effect returns `undefined`, so there's nothing to clean up — correct, since nothing was pushed.

**The whole open/close lifecycle is expressed as one effect with a cleanup.** No `onMount`, no manual subscription. This is the idiomatic Svelte 5 shape for "resource tied to a reactive condition."

**`layer = null` after release** guards against a stale reference.

### `dismiss(then?)`

```ts
function dismiss(then?: () => void) {
  if (!layer) { close(); then?.(); return; }
  const l = layer;
  layer = null;
  close();
  releaseLayer(l, then);
}
```

> *"Closes the layer and runs `then` **only after the history entry has actually unwound** — needed whenever closing is paired with another navigation (opening a different layer, pushing a route), since a pushed/replaced history entry racing an in-flight `history.back()` corrupts the stack."*

**This is the sequencing primitive**, and the bug it prevents is subtle. Consider "tap a search result": close the search sheet, then navigate to the note.

```ts
close();          // fires history.back() — asynchronous
goto("/notes/x"); // fires history.pushState() — immediate
```

The `pushState` lands **before** the `back()` completes. The browser then processes the pending back, which pops the entry you just pushed. You end up somewhere unintended, and the app's model of history no longer matches the browser's.

`dismiss(then)` serialises it: `then` goes into `pendingAfterPop` and runs only when `handlePopState` confirms the `back()` landed.

**`const l = layer; layer = null;` before `close()`** — capture then clear, *then* close. `close()` synchronously triggers the `$effect` cleanup, which checks `if (layer)`. Since it's already `null`, the cleanup does nothing and `releaseLayer` is called exactly once, here, with the `then` attached. Clearing after `close()` would let the cleanup fire its own `releaseLayer` **without** the callback — and `then` would never run.

**`if (!layer)`** — the layer was already released (a back press got there first). `close()` is still called for idempotence, and `then` runs immediately since there's no pending navigation to wait for.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `if (suppressed > 0)` | `handlePopState` | Absorb pops we caused ourselves |
| `pendingAfterPop.shift()?.()` | `handlePopState` | FIFO callback, run when the pop lands |
| `layers.pop()` → `popped = true` → `close()` | `handlePopState` | **Flag before close** — the cleanup reads it synchronously |
| `fallback?.()` | `handlePopState` | Route handling only sees unclaimed events |
| `pushState(state, "")` — no URL | `pushLayer` | Same-hash entry; `svelte-spa-router` never sees it |
| `if (layer.popped)` | `releaseLayer` | The double-unwind guard |
| `indexOf` + `splice`, not `pop` | `releaseLayer` | Layers can close out of order |
| `suppressed += 1` before `back()` | `releaseLayer` | The resulting popstate must be absorbed |
| `suppressed += 1` (**not** `+= N`) | `closeAllLayers` | `go(-N)` fires **one** popstate |
| reverse `for` loop | `closeAllLayers` | Close top-down, matching z-order |
| `popped = true` before each `close()` | `closeAllLayers` | Prevents N stray `back()` calls |
| `$effect` returning a cleanup | `historyLayer` | Push on open, release on close/unmount |
| `layer = null` **before** `close()` | `dismiss` | Ensures the callback isn't dropped by the cleanup |

---

## Suggested experiments

1. Delete `layer.popped = true` in `handlePopState` and press back with a dialog open — watch it navigate twice.
2. Change `suppressed += 1` to `+= toClose.length` in `closeAllLayers`, then press back a few times — later back-presses get eaten.
3. Replace `dismiss(then)` with `close(); then()` at a search-result click site and watch the history desync.
4. Give `pushLayer` a URL argument and watch `svelte-spa-router` re-render on every dialog open.

---

## Related

- [`lib/nav-stack.svelte.ts`](nav-stack.svelte.ts.md) — registers the fallback; the other half of the history system
- [`App.svelte`](../App.svelte.md) — calls `initOverlayHistory()` and `closeTopLayer()` on Escape
- [`lib/actions/drag-dismiss.ts`](actions/drag-dismiss.ts.md) — the drag gesture that also closes overlays
- [`components/ui/Popover.svelte`](../components/ui/Popover.svelte.md), [`AddToSetlistDialog.svelte`](../components/ui/AddToSetlistDialog.svelte.md) — `historyLayer` consumers
