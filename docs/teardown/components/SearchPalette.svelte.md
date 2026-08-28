# `src/components/SearchPalette.svelte`
**Role:** The `Ctrl+K` quick-search overlay. **170 lines.**

## `results`
```ts
const results = $derived.by(() => {
  const q = query.trim().toLowerCase();
  if (!q) return allNotes.slice(0, 8);
  return allNotes.filter(n => …four fields…).slice(0, 8);
});
```
**`$derived.by`**, correctly — see [`FeedClient`](feed/FeedClient.svelte.md) for the bug the `$derived(fn)` form causes.

**An empty query shows the first 8 notes** (newest first, since `listNoteSummaries` orders by `created_at DESC`) rather than nothing — so the palette is useful the instant it opens.

**`.slice(0, 8)`** caps the list. Applied *after* filtering, so it's the top 8 matches.

**The four-field predicate is duplicated from `FeedClient`.** Both now use `includes` on all four; the comment in that file records the bug from when they disagreed.

## The open effect
```ts
$effect(() => {
  if (searchOpenStore.open) {
    // Refetch on every open. Loading only when the cache was empty meant a
    // note created after the first open stayed unsearchable until restart.
    listNoteSummaries().then(ns => allNotes = ns).catch(err => console.error(err));
    tick().then(() => inputEl?.focus());
    query = ""; activeIdx = 0;
  }
});
```
**A cache-staleness bug, recorded.** The obvious optimisation (`if (allNotes.length === 0) load()`) means a note created after the first search is never findable. Always refetching is correct here — the query is cheap ([`listNoteSummaries`](../lib/db.ts.md) skips the body blobs) and the palette opens infrequently.

**`tick().then(() => inputEl?.focus())`** — `tick()` waits for Svelte to flush the DOM. Focusing synchronously would target an element that doesn't exist yet, since `{#if searchOpenStore.open}` hasn't rendered.

**`query = ""` and `activeIdx = 0`** reset state on open, so the palette never reopens showing the last search.

**`.catch(console.error)`** — a failed load leaves the previous list. No user-facing error.

## `handleKeydown`
Four branches: `Escape` → close, `ArrowDown`/`ArrowUp` → move `activeIdx` (each clamped with `Math.min`/`Math.max` so it stops at the ends rather than wrapping), `Enter` → open the active result.

**`e.stopPropagation()` on Escape** — prevents the event also reaching [`App.svelte`](../App.svelte.md)'s global handler, which would call `closeTopLayer()` and then possibly `history.back()`. The palette closes itself via `closeSearch()`.

**`e.preventDefault()` on the arrows** — stops the cursor moving inside the input.

**`list[activeIdx]` guard on Enter** — an empty result list does nothing.

## The clamp effect
```ts
let lastQuery = "";
$effect(() => {
  if (query !== lastQuery) { lastQuery = query; activeIdx = 0; }
  else if (activeIdx >= results.length) { activeIdx = 0; }
});
```
**Manual change detection with a plain `let`.** `lastQuery` is deliberately *not* `$state` — if it were, writing to it inside the effect would re-trigger the effect infinitely. A non-reactive variable is how you keep "previous value" bookkeeping out of the dependency graph.

**Two cases:** a new query resets the highlight to the first row; otherwise the `else if` catches the list shrinking under the cursor for any other reason (a refetch returning fewer notes).

## Template
- **`closeSearch()`, not `searchOpenStore.open = false`** — closing goes through [`nav-stack`](../lib/nav-stack.svelte.ts.md) so the history stack stays consistent. Search is modelled as a *nav level*, not an overlay layer, which is why this component doesn't use `historyLayer`.
- **`goto(...)` on select** — no `dismiss(then)` sequencing needed, because `goto` itself reconciles the stack (search and note are both levels).
- **`items-stretch … sm:items-start sm:pt-[15vh]`** — a full-height sheet on phones, a floating palette 15% down on desktop. One element, two forms.
- **`use:dragDismiss` with `scroller: () => resultsEl`** — drag down to close, but only once the results list is scrolled to the top.
- **`e.target === e.currentTarget`** backdrop test.
- **`{i === activeIdx ? 'bg-muted' : 'hover:bg-muted/50'}`** — keyboard highlight vs mouse hover, mutually exclusive so they can't both light up.
- **The keyboard hints footer is `hidden … sm:block`** — *"Keyboard hints are noise on a touch device."*
- **`<!-- svelte-ignore a11y_no_static_element_interactions -->`** suppresses a warning about the click/keydown handlers on a plain `<div>`. Note this component has **no `role="dialog"`/`aria-modal`**, unlike [`AddToSetlistDialog`](ui/AddToSetlistDialog.svelte.md) and [`KeyboardShortcutsHelp`](KeyboardShortcutsHelp.svelte.md) — an accessibility gap, and the suppressed warning is pointing at it.
- **`activeIdx` isn't reflected in ARIA** — no `aria-activedescendant` or `role="listbox"`, so a screen reader isn't told which row is highlighted.

**Related:** [`lib/search-open.svelte.ts`](../lib/search-open.svelte.ts.md), [`lib/nav-stack.svelte.ts`](../lib/nav-stack.svelte.ts.md), [`components/feed/FeedClient.svelte`](feed/FeedClient.svelte.md), [`App.svelte`](../App.svelte.md)
