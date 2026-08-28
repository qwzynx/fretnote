# `src/components/ui/AddToSetlistDialog.svelte`
**Role:** Bottom sheet (phone) / centred dialog (desktop) for toggling a note's setlist membership. **188 lines.**

## State
```ts
let setlists = $state<Setlist[]>([]);
let membership = $state<Map<string,string>>(new Map()); // setlistId → itemId
```
**A `Map`, not a `Set`.** Membership needs the *item id* to remove (see [`setlists.ts`](../../lib/setlists.ts.md) — removal targets the join row, not the note). `has()` gives the checkbox state, `get()` gives the delete key. One structure, both jobs.

## `load()`
`Promise.all([listSetlists(), getSetlistsForNote(noteId)])` — two independent queries in parallel. `finally` clears `loading` on both paths; no `catch`, so a failure is unhandled (same gap as `SetlistsPage`).

## `$effect(() => { if (open) load(); })`
Reloads **every time the dialog opens**, not once on mount. Correct: setlists may have been created elsewhere since. `open` is the only tracked dependency.

## `toggle(setlistId)`
```ts
const itemId = membership.get(setlistId);
if (itemId) { await removeFromSetlist(itemId); /* local Map delete */ }
else { await addNoteToSetlist(...); /* refetch */ }
```
**Asymmetric on purpose.** Removal knows the key, so it updates locally. Addition doesn't know the *new* item id — [`addNoteToSetlist`](../../lib/setlists.ts.md) returns `void` — so it must refetch to learn it.

**`const next = new Map(membership); next.delete(...); membership = next;`** — copy-then-reassign. Mutating the Map in place would not trigger Svelte reactivity for a `$state`-held Map used this way; reassignment always does.

## `handleCreate()`
Guard on `!newTitle.trim()`, then **create → add → refetch**, three sequential awaits. `setlists = [s, ...setlists]` prepends optimistically (matching `ORDER BY created_at DESC`); the membership refetch is needed for the same reason as above.

## Template
- **`historyLayer(() => open, () => onclose())`** — back button closes it.
- **`use:dragDismiss={{ onDismiss: onclose, scroller: () => listEl, enabled: () => isPhone.current }}`** — the `scroller` getter is why [`drag-dismiss`](../../lib/actions/drag-dismiss.ts.md) has that option: the list must be scrolled to the top before a downward drag dismisses. `enabled` restricts the gesture to phones, where it's a sheet.
- **`e.target === e.currentTarget`** — backdrop-only close, same as `NotePage`'s sheet.
- **`items-end … sm:items-center`** + **`rounded-t-2xl … sm:rounded-xl sm:border`** — one element, two forms: bottom sheet on phones, centred card on desktop. No JS.
- **`max-h-[45vh] overflow-y-auto overscroll-contain`** on the list — bounded height, and `overscroll-contain` stops scroll chaining to the page behind.
- **`{@const inList = membership.has(s.id)}`** drives both the checkbox fill and the `Check` icon.
- **`onkeydown={(e) => e.key === "Enter" && handleCreate()}`** — Enter submits the new-setlist name.
- The grab handle `<div class="h-1 w-10 …">` is `sm:hidden` — only meaningful where dragging works.
- Raw `<input>` and raw `<button>`s rather than [`Input`](Input.svelte.md)/[`Button`](Button.svelte.md), duplicating their styling. Inconsistent with the rest of the codebase.

**Related:** [`lib/setlists.ts`](../../lib/setlists.ts.md), [`lib/overlay-history.svelte.ts`](../../lib/overlay-history.svelte.ts.md), [`pages/NotePage.svelte`](../../pages/NotePage.svelte.md)
