# `src/pages/FeedPage.svelte`

**Role:** The home route (`/`). Loads the library, shows a hero or a header, a "recently viewed" carousel, and delegates the searchable list to `FeedClient`.
**Size:** 196 lines. **Route:** `/`

A good example of the **container/presentational split** used throughout `pages/`: this component owns data loading and state, and hands rendering to `FeedClient` and `NoteCard`.

---

## State

```ts
let notes = $state<NoteSummary[]>([]);
let loadError = $state<string | null>(null);
let loading = $state(true);
let feedQuery = $state("");
let importing = $state(false);
```

**`NoteSummary[]`, not `Note[]`** — the type enforces that this page cannot touch `chordSheet` or `tabBlocks`, matching the `listNoteSummaries` query. See [`types.ts`](../lib/types.ts.md).

**Three separate flags rather than one status union.** A `type Status = "loading" | "error" | "ready"` would make the invalid states unrepresentable; three booleans permit `loading && loadError`. The template guards against it with `!loading && !loadError`, so it's handled by convention rather than by type.

**`loading` starts `true`**, not `false` — so the first render shows the skeleton rather than flashing an empty state before `onMount` runs.

**`feedQuery` is owned here but *used* by `FeedClient`** — see the `bind:` note below.

---

## `reload()`

```ts
async function reload() {
  loading = true;
  try {
    notes = await listNoteSummaries();
    loadError = null;
  } catch (err) {
    console.error(err);
    loadError = "Your library couldn't be opened.";
  } finally {
    loading = false;
  }
}
```

**`loadError = null` inside the `try`, after the assignment** — so a successful retry clears a previous error. Putting it before the `await` would clear the error, then fail, then set it again; putting it in a `finally` would clear it unconditionally. Here it runs only on success.

**`finally` for `loading = false`** — runs on both paths, so an error can never leave the skeleton spinning forever. This is the standard shape and it's correct.

**`console.error(err)` then a friendly message** — the raw error goes to the console for debugging, the user gets a sentence. Note the message is deliberately *not* `err.message`: a SQLite driver error is meaningless to a musician.

**`loading = true` at the top** — so the retry button re-shows the skeleton rather than leaving the error state visible during the second attempt.

---

## `onMount`

```ts
onMount(() => {
  cardActions.openId = null;
  reload();
});
```

**`cardActions.openId = null` — the swipe-tray reset.** If the user swiped a card open, navigated to a note, and came back, the store would still hold that card's id and the tray would be open on arrival. Clearing on mount makes every visit to the feed start clean. See [`card-actions.svelte.ts`](../lib/card-actions.svelte.ts.md).

**`reload()` is not awaited** — `onMount`'s callback returns its result, and returning a promise from `onMount` would be interpreted by Svelte as a cleanup function. Calling it without `await` (and without `return`) is the correct pattern; the state updates land whenever the query resolves.

---

## `handleImportNote()`

```ts
importing = true;
try {
  const imported = await importNote();
  if (imported) {
    toast.success(`Imported "${imported.title}"`);
    goto(`/notes/${imported.id}`);
  }
} catch (e) {
  toast.error(e instanceof Error ? e.message : "Import failed");
} finally {
  importing = false;
}
```

**`if (imported)`** — [`importNote()`](../lib/backup.ts.md) returns `null` for both "user cancelled the picker" and "user declined to overwrite." Neither is an error and neither deserves a toast, so the null case does nothing at all. Silence is the correct response to a cancellation.

**`e instanceof Error ? e.message : "Import failed"`** — and here the raw message *is* shown, unlike `reload()`. That's deliberate: `backup.ts` throws messages written for users (*"This is a single-note file, not a library backup. Use 'Import note' instead."*). The `instanceof` guard covers a non-Error throw, which TypeScript's `unknown` catch type forces you to consider.

**`goto()` after a successful import** — navigate straight to the imported note. Note the list is *not* reloaded first; navigating away makes that unnecessary, and returning to the feed remounts the page and triggers `onMount` → `reload()`.

**`finally` for `importing = false`** — the button's loading state clears on every path including cancellation.

---

## The two optimistic-update handlers

```ts
function handleToggleFavorite(id: string, value: boolean) {
  notes = notes.map((n) => (n.id === id ? { ...n, isFavorite: value } : n));
}

function handleDeleteNote(id: string) {
  notes = notes.filter((n) => n.id !== id);
}
```

**Local state updates, not refetches.** `NoteCard` has already written to the database; these keep the in-memory list in step without a round trip. Re-querying would be simpler but would rebuild and re-render the whole list for a one-field change.

**`notes = notes.map(...)` — reassignment, not mutation.** This is a Svelte 5 requirement worth internalising: `$state` on an array tracks *reassignment*. Mutating in place (`notes[i].isFavorite = value`) works for deep reactivity in Svelte 5's proxied state, but the reassign-with-a-new-array idiom is unambiguous and is what the codebase uses consistently.

**`{ ...n, isFavorite: value }` creates a new object** for the changed note and reuses the existing references for the rest — so keyed `{#each}` blocks only re-render the one card that actually changed.

**Neither handler is `async` and neither can fail.** If the database write in `NoteCard` failed, this page's list would silently disagree with the database until the next reload. A known cost of optimistic updates; acceptable here because the writes are local and near-certain.

---

## `favoriteCount`

```ts
const favoriteCount = $derived(notes.filter((n) => n.isFavorite).length);
```

**`$derived` with an expression** — recomputed only when `notes` changes, and cached between reads. A plain function would recompute on every template read.

---

## `recentNotes` — and a performance comment worth reading

```ts
const recentNotes = $derived.by(() => {
  // One index pass instead of a `notes.find` per recent id, which made this
  // O(recent x notes) — and it was recomputed on every read because the
  // memo was wrapping the arrow function rather than its result.
  const byId = new Map(notes.map((n) => [n.id, n]));
  return getRecentIds()
    .map((id) => byId.get(id))
    .filter((n): n is NoteSummary => !!n);
});
```

**Two separate bugs recorded in one comment.**

**Bug 1 — the algorithm.** The obvious implementation is `getRecentIds().map(id => notes.find(n => n.id === id))`, which scans the whole library for each of up to 10 recent ids: O(recent × notes). Building a `Map` index first makes it O(notes + recent). At a few hundred notes that's the difference between ~3,000 comparisons and ~300 — small in absolute terms, but this recomputes whenever `notes` changes.

**Bug 2 — the reactivity.** *"the memo was wrapping the arrow function rather than its result."* That is:

```ts
const recentNotes = $derived(() => { ... });   // ✗ derives a *function*
const recentNotes = $derived.by(() => { ... }); // ✓ derives the function's *result*
```

`$derived(expr)` memoises the value of `expr`. If `expr` is an arrow function, the memoised value is the function object — which never changes, so the memo never invalidates, and every consumer has to *call* it, recomputing from scratch each time. The memoisation silently does nothing.

**`$derived.by(fn)` is the correct rune for a multi-statement body** — it runs `fn` and memoises its return value. This is the single most common Svelte 5 runes mistake, and it's worth being able to spot: `$derived` takes an expression, `$derived.by` takes a function.

**`.filter((n): n is NoteSummary => !!n)`** — a type predicate narrowing `(NoteSummary | undefined)[]` to `NoteSummary[]`. It drops recent ids whose notes have since been deleted, which is the reason the map can produce `undefined` at all. The third appearance of this idiom, after [`fingering.ts`](../lib/music/fingering.ts.md) and [`backup.ts`](../lib/backup.ts.md).

**`getRecentIds()` is called inside the derived** — but it reads `localStorage`, which is *not* reactive. So this only recomputes when `notes` changes, not when a new view is recorded. Viewing a note then returning to the feed works because the page remounts; but the carousel would not live-update if `recordView` fired while the feed was mounted. A subtle limitation of mixing non-reactive sources into a derived.

---

## The template

### The hero/header switch

```svelte
<!-- The full pitch is for someone who has nothing yet. Once there are songs
     in the library it collapses to a title row, so returning users aren't
     scrolling past a screen of brochure copy to reach their own music. -->
{#if !loading && !loadError && notes.length === 0}
  <section class="…">  <!-- full marketing hero --> </section>
{:else}
  <div class="…">      <!-- compact "Your songbook" header --> </div>
{/if}
```

**A genuinely good product decision, explained.** Onboarding copy is valuable exactly once. Showing it forever would make every returning user scroll past a sales pitch to reach their own library.

**The three-part condition** — `!loading && !loadError && notes.length === 0` — is what stops the hero flashing during load. Without `!loading`, the initial render (before the query resolves, when `notes` is `[]`) would show the full hero and then swap to the header, a visible flash on every visit.

**`{:else}` covers three states at once** — loading, error, and has-notes — which is why the header contains its own `{#if loading}` for the subtitle.

```svelte
{notes.length}
{notes.length === 1 ? "song" : "songs"}{favoriteCount > 0
  ? ` · ${favoriteCount} favourite${favoriteCount === 1 ? "" : "s"}`
  : ""}
```

**Two pluralisations and a conditional clause**, inline. Note `favoriteCount > 0` omits the whole segment rather than printing "0 favourites" — the same instinct as `capo > 0` in [`export.ts`](../lib/export.ts.md). Dense to read; a `$derived` subtitle string would be clearer.

Note the British spelling "favourite" in the UI while the data field is `isFavorite`. Deliberate or not, the split is consistent: American in code, British in copy.

### The two Create buttons

```svelte
<Button href="#/create" onclick={(e: MouseEvent) => goto("/create", e)}>
```

**Both `href` *and* `onclick`, and both are needed.**

- **`href="#/create"`** makes it a real anchor: it shows a status-bar URL on hover, supports Ctrl/middle-click to open a new tab, and is announced correctly by screen readers.
- **`onclick` with `goto(path, e)`** routes the *normal* click through [`nav-stack`](../lib/nav-stack.svelte.ts.md), which is the module's hard invariant — every internal navigation must go through `goto` or `markerCount` desynchronises.

**Passing `e` is what makes both work.** `goto`'s `isNavClick(e)` returns `false` for a modified or middle click and bails *without* calling `preventDefault()`, so the browser performs its native anchor action. For a plain click it calls `preventDefault()` and handles the navigation internally. One binding, correct behaviour for both.

**The Import button has no `href`** — it opens a file dialog, not a URL.

### Recently viewed

```svelte
{#if !loading && recentNotes.length > 0 && !feedQuery}
```

**`!feedQuery` hides the carousel while searching.** Correct: once the user is filtering, "recently viewed" is noise competing with the results they asked for.

```svelte
<div data-no-swipe-nav class="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-1">
```

**`data-no-swipe-nav`** — the opt-out attribute read by [`swipe-horizontal.ts`](../lib/actions/swipe-horizontal.ts.md)'s `closest()` check. Without it, dragging the carousel sideways would trigger section navigation instead of scrolling the carousel. **This is the exact conflict that attribute exists for**, and this is its primary use site.

**`-mx-4 … px-4`** — negative margin plus equal padding is the **full-bleed** technique: the scroll container extends past the parent's padding to the screen edges, while its content stays aligned to the same grid. The comment says why: *"so cards can peek past the edge"* — a partially-visible card is the standard affordance telling users there's more to scroll.

**`snap-x snap-mandatory` + `snap-start`** on children — CSS scroll snapping, so the carousel settles on card boundaries. No JavaScript.

**`no-scrollbar`** — the custom utility from [`globals.css`](../app/globals.css.md).

**`sm:mx-0 sm:px-1`** cancels the full-bleed on larger screens where the layout is already inset.

```svelte
{#each recentNotes as note (note.id)}
```

**Keyed by `note.id`.** Essential here — without the key, Svelte reuses DOM nodes positionally, so a reordered list (which is exactly what an MRU list is) would animate the wrong cards and could misapply the swipe-tray state.

### The feed section — the three-way state

```svelte
{#if loading}
  <span class="sr-only" role="status">Loading your notes…</span>
  <NoteCardSkeleton />
{:else if loadError}
  <EmptyState tone="error" icon={DatabaseZap} title={loadError} description="Your songs are still on disk — this is a problem reading them, not a missing library.">
    {#snippet action()}
      <Button variant="outline" onclick={reload}>Try again</Button>
    {/snippet}
  </EmptyState>
{:else}
  <FeedClient {notes} onToggleFavorite={handleToggleFavorite} onDelete={handleDeleteNote} bind:query={feedQuery} />
{/if}
```

**`<span class="sr-only" role="status">`** — a screen-reader-only live region. A visual skeleton conveys nothing to a screen reader; `role="status"` makes assistive tech announce "Loading your notes…" politely. Small, easy to omit, and correct.

**The error copy is the thoughtful part:** *"Your songs are still on disk — this is a problem reading them, not a missing library."* A database read failure looks identical to data loss from the user's side, and that's a frightening thing to see. One sentence removes the fear. This is what a good error message does.

**The retry works** because [`getDb()`](../lib/db-driver.ts.md) deliberately does *not* cache a failed init — see the `_dbPromise = null` in its catch. If it did, this button would re-fail instantly forever, and the comment in that file says exactly that. **Two files cooperating to make one button honest.**

**`{#snippet action()}`** — Svelte 5 snippets, the replacement for slots. `EmptyState` renders `{@render action?.()}` wherever it wants the button.

**`bind:query={feedQuery}`** — two-way binding. `FeedClient` owns the search input and writes back up, so `FeedPage` can read the query to decide whether to show the recents carousel. That's the only reason the state lives here rather than in `FeedClient`. A one-way `onQueryChange` callback would be more explicit; `bind:` is terser and appropriate for a value with a single owner.

**`{notes}`** — shorthand for `notes={notes}`.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `loading = true` at the top of `reload` | `reload` | Retry re-shows the skeleton |
| `loadError = null` after the `await` | `reload` | Clear only on success |
| `finally { loading = false }` | `reload` | An error can't strand the skeleton |
| `cardActions.openId = null` | `onMount` | Returning to the feed shouldn't find a tray open |
| `reload()` not returned/awaited | `onMount` | A returned promise would be read as a cleanup fn |
| `if (imported)` | `handleImportNote` | Cancel and decline both return `null`, silently |
| `e instanceof Error ? e.message : …` | `handleImportNote` | `backup.ts` throws user-facing messages |
| `notes.map/filter` reassignment | handlers | Optimistic update, no refetch |
| `$derived.by`, not `$derived` | `recentNotes` | `$derived(fn)` memoises the *function*, not its result |
| `new Map(...)` index | `recentNotes` | O(n+m) instead of O(n×m) |
| `(n): n is NoteSummary` | `recentNotes` | Drop recent ids whose notes were deleted |
| `!loading && !loadError && length === 0` | hero | Three conditions to prevent a hero flash on load |
| `!feedQuery` | recents | Hide the carousel while searching |
| `data-no-swipe-nav` | carousel | Sideways scroll must not trigger section nav |
| `-mx-4 px-4` | carousel | Full-bleed so cards peek past the edge |
| `{#each … (note.id)}` | carousel | An MRU list reorders — keying is mandatory |
| `role="status"` + `sr-only` | loading | The skeleton is invisible to screen readers |
| `href` **and** `onclick={… goto(p, e)}` | buttons | Native anchor behaviour *and* the nav-stack invariant |

---

## Related

- [`components/feed/FeedClient.svelte`](../components/feed/FeedClient.svelte.md) — the search/filter/sort UI
- [`components/notes/NoteCard.svelte`](../components/notes/NoteCard.svelte.md) — writes to the DB, calls the handlers here
- [`lib/db.ts`](../lib/db.ts.md) — `listNoteSummaries`, optimised for exactly this page
- [`lib/recent.ts`](../lib/recent.ts.md) — `getRecentIds`
- [`lib/db-driver.ts`](../lib/db-driver.ts.md) — why "Try again" can actually succeed
- [`lib/actions/swipe-horizontal.ts`](../lib/actions/swipe-horizontal.ts.md) — reads `data-no-swipe-nav`
