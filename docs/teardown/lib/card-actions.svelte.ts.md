# `src/lib/card-actions.svelte.ts`

**Role:** Tracks which note card currently has its swipe-action tray open, so opening one closes any other.
**Size:** 6 lines.

---

## Full source

```ts
/** Tracks which note card (if any) currently has its swipe-action tray open, so opening one closes any other. */
class CardActionsStore {
  openId = $state<string | null>(null);
}

export const cardActions = new CardActionsStore();
```

Structurally identical to [`search-open.svelte.ts`](search-open.svelte.ts.md): a `.svelte.ts` module, a class with one `$state` field, and a single exported instance. Read that file's notes for why the class-and-singleton shape is used.

## Why the state holds an **id**, not a boolean

This is the one interesting difference from `searchOpenStore`, and it's the whole design.

The feed renders many `NoteCard` components. Each can swipe open to reveal delete/favourite actions. The requirement — *"opening one closes any other"* — is **mutual exclusion across a dynamic set of siblings**.

A per-card `let open = $state(false)` cannot express that: each card's flag is independent, so swiping a second card leaves the first open. A card would have to somehow reach every sibling to close them.

Storing **which** card is open in one shared place inverts the problem. Each card derives its own state:

```svelte
const isOpen = $derived(cardActions.openId === note.id);
```

and opening is a single write:

```ts
cardActions.openId = note.id;   // implicitly closes whichever was open
```

**No card ever tells another card to close.** The previously-open card's `$derived` simply stops matching and it collapses on its own. One writer, many readers, mutual exclusion for free.

**`null` means "none open"** — a state a boolean-per-card design has no way to represent globally. It's also what a tap-outside or a route change writes.

**`$state<string | null>(null)`** — the explicit type parameter is needed because the initial value `null` would otherwise infer the type as `null`, making any later string assignment an error.

## The general pattern

This is the standard **"single-open" / accordion** pattern, and it generalises to anything where at most one of N things may be active — an open menu, an expanded row, a selected item. Recognising it here makes `NoteCard.svelte` much easier to read: the swipe logic is local, but the *exclusivity* is entirely in this one field.

## Control flow

None. One reactive field.

---

## Related

- [`components/notes/NoteCard.svelte`](../components/notes/NoteCard.svelte.md) — reads and writes `openId`
- [`lib/actions/swipe-horizontal.ts`](actions/swipe-horizontal.ts.md) — the gesture that triggers the write
- [`lib/search-open.svelte.ts`](search-open.svelte.ts.md) — the same store shape with a boolean
