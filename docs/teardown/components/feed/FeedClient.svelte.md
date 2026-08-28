# `src/components/feed/FeedClient.svelte`
**Role:** Search, filter, sort, and grid for the note list. **195 lines.**

**Three bugs are recorded in this file's comments** — read them first; they're the most instructive part.

## Props and the query prop-write
```ts
let { notes, onToggleFavorite, onDelete, query = $bindable("") } = $props();
let _query = $state(query);

function setQuery(next: string) {
  _query = next;
  // Writing the prop here rather than from an $effect: the effect version
  // re-rendered the parent page on every keystroke, which re-ran its own
  // derivations as a side effect of typing.
  query = next;
}
```
**A local `_query` plus an explicit write to the bindable prop.** The tempting version — `$effect(() => { query = _query })` — creates a reactive loop through the parent: every keystroke invalidates the parent, which re-runs *its* derivations ([`FeedPage`](../../pages/FeedPage.svelte.md)'s `recentNotes` rebuilds a Map of the whole library). Writing the prop from the event handler keeps the propagation one-way and once-per-keystroke.

## `results` — `$derived.by`, and the memoisation bug
> *"`$derived.by` memoizes the result. The previous `$derived(() => …)` form memoized the arrow function instead — its identity never changes, so nothing was ever cached and each of the four `results()` reads below re-filtered, re-copied and re-sorted the entire library. **Every keystroke did that work four times over.**"*

**The same bug as `FeedPage`'s `recentNotes`, in the same codebase.** `$derived(expr)` memoises `expr`'s value; if `expr` is a function, the memo holds the function — which never changes, so it never invalidates and never caches. `$derived.by(fn)` memoises `fn()`'s return. **The single most common Svelte 5 runes mistake; worth being able to spot on sight.**

### The filter, and the favourites bug
```ts
// Favourites used to `return` here, which skipped the query entirely —
// searching with the filter on showed every favourite regardless.
if (filter === "favorites") {
  if (!n.isFavorite) return false;
} else if (filter !== "all" && n.type !== filter) {
  return false;
}
if (!q) return true;
```
**The old code was `if (filter === "favorites") return n.isFavorite;`** — an early `return true` that skipped the text search below. The fix is to only ever `return false` here, letting a passing note **fall through** to the query check. A one-word difference (`return` vs `return false` inside a nested `if`) with a very visible symptom.

### The chord-match bug
```ts
// `includes`, to agree with the search palette — this was an exact
// match here, so "Am" found nothing while the palette found "Am7".
n.chords.some((c) => c.toLowerCase().includes(q))
```
**Two search implementations disagreeing.** [`SearchPalette`](../SearchPalette.svelte.md) used `includes`, this used `===`. Same query, different results depending on which UI you used. They now match — but they're still **two separate copies of the same four-field predicate**, so they can drift again.

### The sort
```ts
return list.sort((a, b) => {
  if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
  if (sort === "title")  return a.title.localeCompare(b.title);
  return b.createdAt.localeCompare(a.createdAt);   // newest
});
```
**`localeCompare` on ISO date strings works** because ISO-8601 sorts lexicographically in chronological order — the property [`types.ts`](../../lib/types.ts.md) notes is why dates are stored as strings.

**`list.sort()` mutates**, but `list` is the fresh array from `.filter()`, so `notes` (the prop) is untouched. Correct, if slightly implicit.

## Template
- **`{#if notes.length === 0}`** — the *library* is empty: full [`EmptyState`](../ui/EmptyState.svelte.md) with a Create action, and **no search bar rendered at all**. Searching an empty library is meaningless.
- **`filtering`** gates the "N of M songs" line: *"The page header already states the library total, so this only earns its space once a filter or query has narrowed things."*
- **`aria-live="polite"`** on that count — screen readers hear the result count update as you type, without interrupting.
- **`min-h-9`** on that row reserves its height so the grid doesn't jump when the count appears.
- **`{#if results.length === 0}`** — a *different* empty state (`size="compact"`, `SearchX`) with a "Clear filters" action that resets both axes. The description branches on whether there's a query.
- **The `<Select>` is rendered twice** — `hidden sm:inline-flex` in the toolbar, `sm:hidden` below it — because it belongs in different places at different widths. Both `bind:value={sort}`, so they stay in sync. **This is exactly the bug [`Select`](../ui/Select.svelte.md)'s wrapper comment describes**: `class="sm:hidden"` must land on the wrapper or the chevron is orphaned.
- **Filter chips scroll sideways on phones** (`no-scrollbar -mx-4 … overflow-x-auto px-4`) and become a segmented control at `sm` (`sm:rounded-lg sm:border sm:p-0.5`). Full-bleed negative-margin trick, same as `FeedPage`'s recents carousel. **Note: no `data-no-swipe-nav` here**, so dragging the chip row on a phone may also trigger section navigation — worth testing.
- **`Input` with `value` + `oninput`**, not `bind:value` — so every change goes through `setQuery` and reaches the prop.
- **`type="search"`** gives a native clear button.
- **`{#each results as note (note.id)}`** — keyed, necessary since sorting reorders.
- **`swipeActions` on `NoteCard`** enables the swipe-to-reveal tray; the recents carousel omits it.

**Related:** [`pages/FeedPage.svelte`](../../pages/FeedPage.svelte.md), [`components/notes/NoteCard.svelte`](../notes/NoteCard.svelte.md), [`components/SearchPalette.svelte`](../SearchPalette.svelte.md), [`components/ui/Select.svelte`](../ui/Select.svelte.md)
