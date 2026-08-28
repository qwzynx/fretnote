# `src/pages/NotePage.svelte`

**Role:** The note detail route (`/notes/:id`). Header, metadata badges, action menus (desktop dropdown / phone sheet), back-swipe gesture, and the reader.
**Size:** 389 lines. **Route:** `/notes/:id`

The busiest page — it wires together six `lib/` modules and demonstrates nearly every pattern in the codebase at once.

---

## `DIFFICULTY_LABEL`

```ts
const DIFFICULTY_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;
```

A display-name lookup, module-level so it isn't rebuilt per render. `as const` gives literal types, so `DIFFICULTY_LABEL[note.difficulty]` is exhaustively checked — adding a fourth `Difficulty` would fail to compile here.

---

## The three-state `note`

```ts
let note = $state<Note | null | undefined>(undefined);
```

**Three states in one variable**, and the distinction drives the whole template:

| Value | Meaning | Renders |
|---|---|---|
| `undefined` | Not loaded yet | "Loading…" |
| `null` | Loaded, not found | "Note not found." + back link |
| `Note` | Loaded | The page |

This is the alternative to `FeedPage`'s three separate booleans, and it's the better model here: the states are genuinely mutually exclusive, so one variable makes the invalid combinations unrepresentable. `getNote()` already returns `Note | null` (see [`db.ts`](../lib/db.ts.md)), so only `undefined` is added.

**`===` comparisons in the template** — `note === undefined` and `note === null`. Necessary: `null` and `undefined` are `==`-equal, so loose comparison would collapse the two states.

---

## `isFav` — deliberately duplicated state

```ts
let isFav = $state(false);
...
isFav = note?.isFavorite ?? false;
```

**A copy of `note.isFavorite`**, seeded on load. It exists so the heart can flip **instantly** on tap without waiting for the database write, and without mutating `note` (which would invalidate every `$derived` reading it and re-render the whole page for a one-pixel change).

```ts
async function handleToggleFavorite() {
  if (!note) return;
  const next = !isFav;
  isFav = next;
  await toggleFavorite(note.id, next);
}
```

**`const next = !isFav` computed once**, then used for both the UI and the write — so the two can't disagree if the value changed between them. Passing an explicit value (rather than a SQL toggle) also makes double-taps idempotent; see [`db.ts`](../lib/db.ts.md)'s `toggleFavorite`.

**Optimistic: the UI updates before the write and there's no rollback.** A failed write would leave the heart lying until reload. Accepted, as in `FeedPage`.

**The cost of the duplication:** `note.isFavorite` is now stale. Nothing reads it after load, so it doesn't bite — but it's a real inconsistency to be aware of.

---

## The back-swipe gesture

```ts
let mainEl: HTMLElement;

function handleBackDragMove(dx: number) {
  if (!mainEl) return;
  mainEl.style.transition = "none";
  mainEl.style.transform = `translateX(${Math.max(0, dx)}px)`;
}

function handleBackCommit() {
  if (!mainEl) return;
  mainEl.style.transition = "transform 180ms ease-in";
  mainEl.style.transform = "translateX(100%)";
  setTimeout(() => window.history.back(), 180);
}

function handleBackCancel() {
  if (!mainEl) return;
  mainEl.style.transition = "transform 200ms ease-out";
  mainEl.style.transform = "translateX(0)";
}
```

**This is the caller-owns-presentation half of [`swipeHorizontal`](../lib/actions/swipe-horizontal.ts.md).** That action detects the gesture and reports numbers; these three functions do the drawing. Compare [`drag-dismiss.ts`](../lib/actions/drag-dismiss.ts.md), which owns its own transform — the split is exactly why one action delegates and the other doesn't.

**`if (!mainEl) return`** in all three — `bind:this` is populated after mount, and a callback could in principle fire first.

**`Math.max(0, dx)`** — clamps to rightward only. Same instinct as `drag-dismiss`'s `Math.max(0, curDy)`: dragging back past the origin pins the page at rest.

**`transition = "none"` during the drag**, restored to a real duration on release — the identical pattern to `drag-dismiss`, here spelled out by the caller.

**`ease-in` for commit (leaving), `ease-out` for cancel (settling)** — and note the durations, `180ms` vs `200ms`. The same asymmetry as `drag-dismiss` (160/200): departures are quicker than returns.

**`setTimeout(() => window.history.back(), 180)` matches the transition duration** — navigate only after the page has slid off. The same hardcoded-duplicate-of-the-CSS-duration trade as `drag-dismiss`, with the same caveat: change one number, change both.

**`window.history.back()`, not `goto("/")`** — deliberate, and it matters. A real `popstate` flows through [`overlay-history`](../lib/overlay-history.svelte.ts.md)'s single listener into [`nav-stack`](../lib/nav-stack.svelte.ts.md)'s `handleNavPop`, so the swipe behaves *identically* to the Android hardware button and to Escape in [`App.svelte`](../App.svelte.md). Three input methods, one code path. Calling `goto` would bypass the fallback chain and desynchronise `markerCount`.

**Nothing resets the transform after `history.back()`** — the component unmounts, so there's nothing to reset.

### Wiring it up

```svelte
use:swipeHorizontal={{
  directions: "right",
  enabled: () => isTouch.current,
  distanceThreshold: mainEl ? Math.min(140, mainEl.clientWidth * 0.35) : 100,
  onDragMove: handleBackDragMove,
  onCommit: handleBackCommit,
  onCancel: handleBackCancel,
}}
```

**`directions: "right"`** — only left-to-right is back. A leftward drag is left to the browser, so horizontally scrollable content still works.

**`enabled: () => isTouch.current`** — a getter, so it's evaluated per touch and tracks a device change. Gesture navigation on a mouse would be a bug; see [`media.svelte.ts`](../lib/media.svelte.ts.md).

**`Math.min(140, clientWidth * 0.35)`** — a **responsive threshold**: 35% of the page width, capped at 140px. On a narrow phone that's ~130px; on a tablet the cap stops it demanding an absurd drag. `mainEl ? … : 100` covers the first render before the binding lands.

**Note there is no `edgeGate`** — this swipe works from anywhere on the page, not just the left edge. That's a deliberate divergence from the iOS convention, and it's why `data-no-swipe-nav` matters on any horizontally scrollable child.

---

## The two overlay layers

```ts
historyLayer(() => exportOpen, () => (exportOpen = false));
const actionsLayer = historyLayer(() => actionsOpen, () => (actionsOpen = false));
```

Both register with [`overlay-history`](../lib/overlay-history.svelte.ts.md), so the back button closes them before it navigates.

**The export dropdown's return value is discarded**; the actions sheet's is kept. The difference is that the sheet needs `dismiss(then)` — see below. When a close isn't paired with another navigation, plain state assignment is enough.

**Getters, not values** — `() => exportOpen` is what makes the internal `$effect` reactive.

---

## `handleExportOutsideClick`

```svelte
<svelte:window onclick={handleExportOutsideClick} />
```
```ts
function handleExportOutsideClick(e: MouseEvent) {
  if (exportOpen && exportEl && !exportEl.contains(e.target as Node)) {
    exportOpen = false;
  }
}
```

**The classic click-outside-to-close.** `exportEl.contains(e.target)` tests whether the click landed inside the dropdown's wrapper; if not, close.

**Three conditions, short-circuited in cost order** — the cheap boolean first, the binding check second, the DOM walk last. So the `contains()` call only runs while the menu is actually open.

**`<svelte:window>`** binds to `window` with automatic cleanup on unmount — the declarative equivalent of `App.svelte`'s manual `addEventListener` pair.

**A subtlety:** the toggle button is *inside* `exportEl`, so clicking it fires both this handler (which sees the click as inside and does nothing) and the button's own `onclick={() => (exportOpen = !exportOpen)}`. Without that containment the two would fight and the menu would never open.

---

## `onMount`

```ts
onMount(async () => {
  if (!params.id) return;
  note = await getNote(params.id);
  isFav = note?.isFavorite ?? false;
  if (note) recordView(note.id);
});
```

**`async` here, unlike `FeedPage`'s sync callback.** Fine because nothing is returned, so Svelte can't mistake the promise for a cleanup function — but it's the pattern to watch: `onMount(async () => …)` silently loses cleanup support.

**`note?.isFavorite ?? false`** — `??` not `||`, though both behave the same for a boolean. Consistent with the codebase's habit.

**`if (note) recordView(note.id)`** — only real notes enter the recent list, so a bad URL doesn't poison it. `recordView` is fire-and-forget (synchronous, and its write is wrapped in a swallowing try/catch — see [`recent.ts`](../lib/recent.ts.md)).

**Note `params.id` is read once, not `$derived`** — so navigating from one note to another *without unmounting* would not reload. Whether that happens depends on the router; `CreatePage` uses `$derived` for the same value, which suggests it can. A likely latent bug worth testing: open note A, then use search to jump to note B.

---

## The three export handlers

All three share a shape:

```ts
async function handleCopyText() {
  if (!note) return;
  exportOpen = false;
  actionsOpen = false;
  try {
    await copyTextToClipboard(noteToText(note));
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy to clipboard");
  }
}
```

**Both menus are closed unconditionally**, because each action is reachable from either the desktop dropdown or the phone sheet and the handler doesn't know which. Setting both is cheaper than threading a source parameter.

**Note this closes `actionsOpen` by plain assignment, not `actionsLayer.dismiss()`** — and that's correct: nothing here navigates, so there's no history race to sequence. `dismiss()` is only needed when a close is *paired* with a push.

**`catch` with no binding** — the errors carry nothing worth showing; a fixed message is friendlier.

**`if (saved) toast.success(...)`** in `handleExportNoteFile` — [`exportNote`](../lib/backup.ts.md) returns `false` when the user cancels the save dialog. Cancellation gets no toast. Same discipline as `FeedPage`'s `if (imported)`.

**`handleExportPdf` shows no success toast at all** — a saved file is its own confirmation, and on the browser path the download UI already says so.

```ts
async function handleDelete() {
  if (!note) return;
  actionsOpen = false;
  if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
  await deleteNote(note.id);
  goto("/");
}
```

**`actionsOpen = false` *before* the confirm** — so the sheet isn't sitting behind the blocking native dialog.

**`confirm()` — the native dialog again**, as in [`backup.ts`](../lib/backup.ts.md)'s `importNote`. Blocking and unstyled, inconsistent with the design system, but used for the two genuinely destructive actions.

**`goto("/")` after deleting** — navigate away, since this route no longer resolves. Note `nav-stack` will collapse the stack to `[home]`, so back won't return to the deleted note.

---

## The template

### `{@const noteId = note.id}`

```svelte
{:else}
  {@const noteId = note.id}
```

**A narrowing workaround.** Inside the `{:else}` branch Svelte knows `note` is a `Note`, but that narrowing does **not** survive into an event-handler closure — `note` could in principle be reassigned before the handler fires, so `note.id` inside `onclick` is an error against `Note | null | undefined`.

`{@const}` captures the value at render time, so the closure closes over a plain `string`. Declared twice (once here, once inside the action sheet) because `{@const}` is scoped to its immediate block.

### `<svelte:window>` and the three-way state

```svelte
{#if note === undefined}      … Loading …
{:else if note === null}      … Not found + back link …
{:else}                       … the page …
{/if}
```

The direct rendering of the three-state variable. Note the not-found branch offers a way out rather than being a dead end.

### The responsive action split

```svelte
<Button class="sm:hidden" onclick={() => (actionsOpen = true)}>   <!-- phone: one overflow button -->
<div class="hidden items-center gap-2 sm:flex">                    <!-- desktop: full button row -->
```

**Two complete UIs, switched by CSS.** Both are in the DOM at all times; `sm:hidden` / `hidden sm:flex` decide which is visible.

**Why CSS rather than `{#if isPhone.current}`:** no JavaScript, no reflow on resize, and no hydration flash. This is the "express it in CSS when you can" rule from [`media.svelte.ts`](../lib/media.svelte.ts.md) — and the contrast with the `enabled: () => isTouch.current` above is instructive: *visibility* is CSS's job, *whether to attach a gesture handler* is not.

**The cost:** both action lists are duplicated in the template, so an added action must be added twice. Real duplication, and the most likely place for the two to drift.

**`<span class="hidden sm:inline">Back to notes</span>` / `<span class="sm:hidden">Notes</span>`** — the same technique at word level, shortening the label on narrow screens.

### The metadata badges

```svelte
{#if note.capo > 0}
  <Badge variant="secondary">Capo {note.capo}</Badge>
  <Badge variant="outline">Sounds like {transposeKey(note.key, note.capo)}</Badge>
{/if}
```

**`transposeKey(note.key, note.capo)`** — the third place this calculation appears, after `noteHeaderLines` and the PDF meta block in [`export.ts`](../lib/export.ts.md). The `capo > 0` guard is likewise repeated. A shared helper would consolidate all three.

**`class="font-mono"` on the key badge** — JetBrains Mono for a musical symbol, so `F#m` renders with even spacing.

```svelte
{#each note.tags as t}
```

**Unkeyed** — acceptable here because tags are static strings rendered as leaf spans with no state. Contrast the keyed `{#each recentNotes as note (note.id)}` in `FeedPage`, where reordering matters.

### The phone action sheet

```svelte
<div role="dialog" tabindex="-1" aria-modal="true" aria-label="Note actions"
     class="fixed inset-0 z-50 flex items-end bg-scrim backdrop-blur-sm sm:hidden"
     onclick={(e) => { if (e.target === e.currentTarget) actionsOpen = false; }}
     onkeydown={(e) => { if (e.key === "Escape") actionsOpen = false; }}>
```

**`e.target === e.currentTarget`** — the backdrop-click test. `currentTarget` is the element the handler is bound to (the backdrop); `target` is what was actually clicked. Equal means the click hit the backdrop itself, not a child. **Cheaper and more precise than `contains()`**, and it avoids the bug where clicking inside the sheet dismisses it.

**`role="dialog"` + `aria-modal="true"` + `aria-label`** — the ARIA contract for a modal. **`tabindex="-1"`** makes the div focusable so it can receive the `keydown`; without it a `div` isn't in the tab order and the Escape handler would never fire.

**`bg-scrim`** — the design token from [`globals.css`](../app/globals.css.md), added specifically to replace four copies of `bg-black/60`.

```svelte
{@const sheetItem = "flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left text-base active:bg-muted"}
```

**A class string hoisted into a `{@const}`** and reused on six buttons. Note `py-3.5` (14px vertical padding) — deliberately generous for touch targets, and `text-base` rather than `text-sm` for the same reason. `active:` rather than `hover:` because there's no hover on touch.

**`class="{sheetItem} text-destructive"`** on Delete — string interpolation appending a modifier. Note this bypasses `cn()`/`twMerge`, so there's no conflict resolution; safe here because `text-destructive` doesn't collide with anything in `sheetItem`.

```svelte
use:dragDismiss={{ onDismiss: () => (actionsOpen = false) }}
```

**[`dragDismiss`](../lib/actions/drag-dismiss.ts.md) on the panel**, not the backdrop — so dragging the sheet down closes it. No `scroller` option, since the sheet is short and doesn't scroll.

**`<div class="mx-auto mb-1 h-1 w-10 rounded-full bg-muted-foreground/30">`** — the grab handle. Purely an affordance, telling the user the sheet is draggable.

**`pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]`** — arbitrary-value padding for the home indicator. Note this inlines `env()` rather than using the `--spacing-safe-b` token from `globals.css`; a small inconsistency.

### The two `dismiss()` call sites

```svelte
onclick={() => actionsLayer.dismiss(() => (setlistDialogOpen = true))}
onclick={() => actionsLayer.dismiss(() => goto(`/notes/${noteId}/edit`))}
```

**These are the only two buttons in the sheet using `dismiss(then)`, and it's exactly the right two.** Both pair closing the sheet with *another history operation*:

- Opening the setlist dialog **pushes** a new layer.
- `goto` **pushes** a route level.

Per [`overlay-history`](../lib/overlay-history.svelte.ts.md)'s comment, a push racing an in-flight `history.back()` corrupts the stack. `dismiss(then)` sequences them: the callback runs only once the sheet's own history entry has actually unwound.

The other four buttons (copy, PDF, export, delete) do no history work, so plain assignment suffices. **Comparing the two groups is the clearest illustration in the codebase of when `dismiss(then)` is required** — and delete is the interesting borderline: it *does* navigate, but via `goto("/")` after an `await`, by which time the pop has landed.

### `{#if note}` around the dialog

```svelte
{#if note}
  <AddToSetlistDialog noteId={note.id} open={setlistDialogOpen} onclose={…} />
{/if}
```

Redundant — this is already inside the `{:else}` branch where `note` is a `Note`. Present because TypeScript's narrowing doesn't reach the prop expression cleanly. Harmless.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `Note \| null \| undefined` | state | Three genuinely exclusive states in one variable |
| `note === undefined` / `=== null` | template | `==` would collapse the two |
| `isFav` duplicated from `note` | state | Instant toggle without re-rendering the page |
| `const next = !isFav` | `handleToggleFavorite` | UI and write can't disagree |
| `if (!mainEl) return` ×3 | drag handlers | `bind:this` lands after mount |
| `Math.max(0, dx)` | `handleBackDragMove` | Pin at rest when dragged back |
| `setTimeout(…, 180)` = transition | `handleBackCommit` | Navigate after the slide completes |
| `window.history.back()` not `goto` | `handleBackCommit` | Same pipeline as hardware back and Escape |
| `Math.min(140, width * 0.35)` | swipe options | Responsive threshold with a cap |
| `enabled: () => isTouch.current` | swipe options | Getter, evaluated per touch |
| `exportOpen && exportEl && !contains()` | outside-click | Short-circuit in cost order |
| `if (note) recordView(...)` | `onMount` | A bad URL mustn't poison the recent list |
| both menus closed in every handler | exports | The action is reachable from either UI |
| `if (saved)` / `if (imported)` | export handlers | Cancellation is silent |
| `actionsOpen = false` before `confirm` | `handleDelete` | Don't leave a sheet behind a native dialog |
| `{@const noteId = note.id}` | template ×2 | Narrowing doesn't survive into closures |
| `sm:hidden` / `hidden sm:flex` | actions | Two full UIs, switched by CSS |
| `e.target === e.currentTarget` | backdrop | Precise backdrop-only click test |
| `tabindex="-1"` | sheet | A div can't receive keydown without it |
| `dismiss(then)` on 2 of 6 buttons | sheet | Only where closing is paired with a push |

---

## Related

- [`components/notes/NoteReader.svelte`](../components/notes/NoteReader.svelte.md) — the actual song rendering
- [`components/ui/AddToSetlistDialog.svelte`](../components/ui/AddToSetlistDialog.svelte.md)
- [`lib/overlay-history.svelte.ts`](../lib/overlay-history.svelte.ts.md) — `historyLayer`, and why `dismiss(then)` exists
- [`lib/actions/swipe-horizontal.ts`](../lib/actions/swipe-horizontal.ts.md) — the gesture this page draws for
- [`lib/export.ts`](../lib/export.ts.md) / [`lib/backup.ts`](../lib/backup.ts.md) — the three export paths
- [`lib/db.ts`](../lib/db.ts.md) — `getNote`, `toggleFavorite`, `deleteNote`
