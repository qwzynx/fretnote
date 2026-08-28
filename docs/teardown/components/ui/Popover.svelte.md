# `src/components/ui/Popover.svelte`

**Role:** A floating panel anchored to a trigger — used for chord diagrams over chord names in the reader.
**Size:** 92 lines. **Depends on:** `@/lib/overlay-history.svelte`.

**The most technically involved `ui/` component.** It hand-implements portalling, viewport-aware positioning, flip-on-collision, and outside-click dismissal — the things a library like Floating UI would provide.

---

## Props and state

```ts
let { trigger, content, class: className = "" }: { trigger: Snippet; content: Snippet; class?: string } = $props();

let open = $state(false);
let containerEl: HTMLElement;
let panelEl = $state<HTMLElement>();
let ready = $state(false);
let top = $state(0);
let left = $state(0);
```

**Two required snippets** — `trigger` (always rendered) and `content` (only when open). A snippet-based API rather than props, so callers pass arbitrary markup.

**Note the asymmetry: `containerEl` is a plain `let`, `panelEl` is `$state`.** That's not sloppiness. `containerEl` is only ever *read* inside event handlers, which run after mount. `panelEl` is bound to an element inside `{#if open}` — it appears and disappears — and the `$effect` below must re-run when it does. Only `$state` triggers that.

**`ready`** guards the first frame. See below.

---

## `historyLayer` registration

```ts
historyLayer(() => open, () => (open = false));
```

**Registers with [`overlay-history`](../../lib/overlay-history.svelte.ts.md)** so the Android back button closes the popover instead of navigating. The return value is discarded — `dismiss(then)` isn't needed because closing a chord diagram is never paired with another navigation.

**A getter, not a value**, so the internal `$effect` tracks `open` reactively.

---

## `handleOutsideClick`

```svelte
<svelte:window onclick={handleOutsideClick} />
```
```ts
function handleOutsideClick(e: MouseEvent) {
  const target = e.target as Node;
  if (open && !containerEl?.contains(target) && !panelEl?.contains(target)) {
    open = false;
  }
}
```

**Two `contains` checks, not one** — and that's forced by the portal. The panel is moved to `document.body`, so it is **not** a DOM descendant of `containerEl`. A single `!containerEl.contains(target)` would treat every click *inside the panel* as an outside click and close it immediately.

Compare [`NotePage`](../../pages/NotePage.svelte.md)'s export dropdown, which needs only one check because it isn't portalled. **Portalling buys correct stacking and costs a second containment test** — a tradeoff worth recognising.

**`open &&` first** short-circuits the DOM walks when closed.

---

## `reposition()` — the positioning maths

```ts
function reposition() {
  if (!containerEl || !panelEl) return;
  const trig = containerEl.getBoundingClientRect();
  const panelW = panelEl.offsetWidth;
  const panelH = panelEl.offsetHeight;
  const margin = 8;

  let l = trig.left + trig.width / 2 - panelW / 2;
  l = Math.min(Math.max(l, margin), window.innerWidth - panelW - margin);

  // Prefer opening above the trigger; flip below when there isn't room
  // (e.g. the first lyric line, right under the sticky toolbar).
  let t = trig.top - panelH - 6;
  if (t < margin) t = trig.bottom + 6;

  left = l;
  top = t;
  ready = true;
}
```

### Horizontal: centre, then clamp

**`trig.left + trig.width / 2 - panelW / 2`** — centre the panel on the trigger's centre.

**`Math.min(Math.max(l, margin), window.innerWidth - panelW - margin)`** — the clamp. Read inside out: `max(l, 8)` stops it going off the left edge; `min(…, innerWidth - panelW - 8)` stops the right. **This is what keeps a chord diagram on a word near the screen edge fully visible** rather than half-clipped — the single most valuable line for the actual use case, since chord markers frequently sit at the end of a lyric line.

`margin = 8` is a shared constant used in three places.

### Vertical: prefer above, flip below

**`trig.top - panelH - 6`** — sit the panel above the trigger with a 6px gap.

**`if (t < margin) t = trig.bottom + 6`** — collision detection. If the preferred position would be within 8px of the viewport top, flip below instead.

**The comment names the real case:** a chord on the *first lyric line*, immediately under the sticky toolbar, has no room above. Without the flip it would render off-screen.

**Why above is preferred at all:** the trigger is a chord name inside lyrics, and the user is reading downward. A panel above covers text already read; below would cover the words they're about to sing.

**One-directional flip only** — there's no check for running off the *bottom*. A trigger near the bottom of a tall viewport with a tall panel could overflow downward. Not reachable with the small chord diagrams in use.

**`offsetWidth`/`offsetHeight` rather than a second `getBoundingClientRect`** — integer layout dimensions, and cheaper. Both force a synchronous layout read, which is why this runs in a `requestAnimationFrame`.

---

## The `$effect` — lifecycle and listeners

```ts
$effect(() => {
  if (!open) { ready = false; return; }
  ready = false;
  const raf = requestAnimationFrame(reposition);
  window.addEventListener("resize", reposition);
  // Scroll events don't bubble, so the capture phase is what catches the
  // app's inner scroll container — the window itself never scrolls.
  window.addEventListener("scroll", reposition, true);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
  };
});
```

### `ready` and the first-frame flash

**`ready = false` on both paths**, then `true` at the end of `reposition`. It drives:

```svelte
style="… opacity: {ready ? 1 : 0}; pointer-events: {ready ? 'auto' : 'none'}"
```

**The problem it solves:** the panel must be **in the DOM and laid out** before `offsetWidth`/`offsetHeight` can be measured. So on the frame it first renders, `top`/`left` are still `0` — the panel would flash in the top-left corner before jumping into place.

**The fix:** render it invisible, measure, position, then reveal.

**`opacity: 0` rather than `visibility: hidden` or `display: none`** — this is the crucial detail. `display: none` gives zero dimensions, so the measurement would be meaningless. `opacity: 0` keeps the element fully laid out and measurable while invisible. **`pointer-events: none`** additionally stops the unpositioned panel from swallowing clicks during that one frame.

The same `invisible`-vs-`hidden` distinction as [`Button`](Button.svelte.md)'s loading state, for the same underlying reason.

### `requestAnimationFrame(reposition)`

**Defers measurement until after the browser has laid the panel out.** Calling `reposition()` synchronously in the effect would read dimensions of an element that may not have been laid out yet.

**`cancelAnimationFrame` in the cleanup** — closing before the frame fires must not leave a callback that touches a removed element.

### The capture-phase scroll listener

```ts
window.addEventListener("scroll", reposition, true);
```

> *"Scroll events don't bubble, so the capture phase is what catches the app's inner scroll container — the window itself never scrolls."*

**The sharpest observation in the file.** Two facts combine:

1. **`scroll` does not bubble** from an element to `window`.
2. **The window never scrolls in this app.** [`App.svelte`](../../App.svelte.md)'s shell is `h-dvh overflow-hidden`; scrolling happens in an inner `overflow-y-auto` div.

So a normal bubble-phase `window` scroll listener would **never fire**, and the popover would drift away from its trigger as the user scrolls.

**Capture phase (`true`) fires on the way *down* the tree**, so a `window` listener sees scroll events targeted at any descendant. One listener catches every scroll container without knowing which one is scrolling.

**Both `addEventListener` and `removeEventListener` pass `true`** — the capture flag is part of the listener's identity, and omitting it on removal would leak the listener. A common mistake, handled correctly.

### The cleanup

**Returned from the `$effect`**, so Svelte runs it before the effect re-runs and on unmount. Since the effect depends on `open`, closing the popover tears down all three listeners. **No listeners exist while the popover is closed** — the right default when many popovers exist in a long chord sheet.

---

## `portal` — a 4-line action

```ts
function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return { destroy: () => node.remove() };
}
```

**Moves the panel to `document.body`.** A Svelte action (see [`drag-dismiss.ts`](../../lib/actions/drag-dismiss.ts.md) for the action contract).

**Why portal at all:** the trigger is inline inside lyric text, which lives in containers with `overflow` and stacking contexts. A panel rendered in place would be **clipped by an ancestor's `overflow: hidden`** and could lose z-index battles regardless of how high its `z-50` is — `z-index` only competes within a stacking context.

Appending to `body` escapes both. The cost is the second `contains` check in `handleOutsideClick`, and that the panel must be `position: fixed` with manually computed coordinates — which is the whole of `reposition()`.

**`node.remove()` on destroy** — without it, every opened popover would leave an orphan div on `body` forever.

**No named-target option and no restore-to-original-parent** — the minimum that works. Real portal implementations do more; this is 4 lines for the same effect in this app.

---

## The markup

```svelte
<span bind:this={containerEl} class="relative inline-block {className}">
  <span onclick={(e) => { e.stopPropagation(); open = !open; }} role="none">
    {@render trigger()}
  </span>
  {#if open}
    <div use:portal bind:this={panelEl}
         class="fixed z-50 w-max max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md"
         style="top: {top}px; left: {left}px; opacity: {ready ? 1 : 0}; pointer-events: {ready ? 'auto' : 'none'}"
         role="tooltip">
      {@render content()}
    </div>
  {/if}
</span>
```

**`<span>`, not `<div>`** — the trigger sits inline in lyric text, where a block element would break the line.

**`e.stopPropagation()` on the trigger** — essential. Without it the click would also reach the `<svelte:window onclick>` handler, which would see it as outside (it fires after the toggle, when `open` is already `true`) and close the popover immediately. **The popover would never open.** Compare `NotePage`'s export menu, which avoids this by having its toggle *inside* the element it tests containment against.

**`role="none"`** on the trigger wrapper — removes its implicit semantics so it doesn't add a meaningless element to the accessibility tree. **But there's a gap:** a `<span>` with an `onclick` and no `role="button"`, `tabindex`, or keyboard handler is **not keyboard accessible**. The popover can only be opened with a pointer. `role="none"` suppresses the warning rather than fixing the problem.

**`fixed`, not `absolute`** — required by the portal. Coordinates come from `getBoundingClientRect`, which is viewport-relative, matching `fixed`'s coordinate system exactly.

**`w-max`** — size to content without wrapping. **`max-w-[calc(100vw-1rem)]`** caps it at the viewport minus the 8px margins on each side, so `reposition`'s clamp can always find a valid position.

**`bg-popover`** — `--surface-2`, the level above cards. The four-step ramp in [`globals.css`](../../app/globals.css.md) exists precisely so this reads as floating above a card rather than flush with it.

**`role="tooltip"`** — semantically debatable. A tooltip is descriptive and typically hover-triggered; this is click-triggered and contains a diagram. `role="dialog"` would be more accurate but implies focus management this component doesn't do.

---

## Control flow summary

| Construct | Purpose |
|---|---|
| `panelEl` is `$state`, `containerEl` isn't | Only the portalled panel appears/disappears, driving the effect |
| two `contains` checks | The portal makes the panel a non-descendant |
| `Math.min(Math.max(l, 8), …)` | Keep the panel on screen near either edge |
| `if (t < margin) t = trig.bottom + 6` | Flip below when there's no room above |
| `ready` + `opacity: 0` | Measure before revealing — no first-frame flash |
| `opacity`, not `display: none` | A hidden element has no measurable dimensions |
| `requestAnimationFrame(reposition)` | Measure after layout, not during the effect |
| `scroll` listener with `capture: true` | Scroll doesn't bubble, and the window never scrolls |
| `true` on **both** add and remove | The capture flag is part of listener identity |
| effect cleanup | No listeners at all while closed |
| `use:portal` → `body` | Escape ancestor `overflow` and stacking contexts |
| `e.stopPropagation()` | Otherwise the window handler closes it on the opening click |
| `fixed` + computed `top`/`left` | Matches `getBoundingClientRect`'s coordinate system |

---

## Known gaps

1. **Not keyboard accessible** — the trigger is a `<span>` with no `tabindex` or key handler.
2. **No flip for bottom overflow** — only the top edge is checked.
3. **`role="tooltip"`** is a loose fit for click-triggered content.

---

## Related
- [`lib/overlay-history.svelte.ts`](../../lib/overlay-history.svelte.ts.md) — `historyLayer`
- [`App.svelte`](../../App.svelte.md) — the inner scroll container the capture listener exists for
- [`components/notes/ChordLyricsView.svelte`](../notes/ChordLyricsView.svelte.md) — the consumer
- [`app/globals.css`](../../app/globals.css.md) — `--popover` and the four-step surface ramp
