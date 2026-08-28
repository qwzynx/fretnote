# `src/pages/SetlistsPage.svelte`

**Role:** The setlists index (`/setlists`). Lists setlists as cards, with an inline create form and per-card delete.
**Size:** 167 lines. **Route:** `/setlists`

The simplest of the list pages — a useful baseline to compare `FeedPage` against.

---

## State

```ts
let setlists = $state<Setlist[]>([]);
let loading = $state(true);
let creating = $state(false);   // is the inline create form open?
let newTitle = $state("");
let newDesc = $state("");
let saving = $state(false);
```

**Six flat variables** with no derived values at all. Note there is **no `loadError`** — compare `FeedPage`, which has a full error state with a retry button. Here a failed load silently yields an empty list that reads as "No setlists yet," which is a lie: the user's setlists still exist, they just couldn't be read. The most significant gap on this page.

**`creating` drives an inline form** rather than a dialog — no `historyLayer`, so the Android back button won't close it. Consistent with it being an inline panel rather than an overlay.

---

## `onMount`

```ts
onMount(async () => {
  try {
    setlists = await listSetlists();
  } finally {
    loading = false;
  }
});
```

**`try`/`finally` with no `catch`** — an unusual and deliberate shape. The `finally` guarantees the spinner clears; the absence of `catch` means the error **propagates as an unhandled promise rejection**. So it lands in the console but produces no UI at all.

That's the mechanism behind the missing error state: the code is careful enough not to hang the spinner, but stops short of telling the user anything.

Compare [`db-driver.web.ts`](../lib/db-driver.web.ts.md)'s `select`, which uses the same catch-less `try`/`finally` — there it's correct, because the caller genuinely should see the error. Here nobody is catching.

---

## `handleCreate`

```ts
async function handleCreate() {
  if (!newTitle.trim()) return;
  saving = true;
  try {
    const s = await createSetlist(newTitle.trim(), newDesc.trim());
    setlists = [s, ...setlists];
    newTitle = "";
    newDesc = "";
    creating = false;
    toast.success("Setlist created");
  } catch {
    toast.error("Failed to create setlist");
  } finally {
    saving = false;
  }
}
```

**`if (!newTitle.trim()) return`** — a whitespace-only title is rejected. Guards against the button being triggered by Enter even though it's also `disabled` in the template. Validation in both places is correct: the disabled attribute is a hint, not a guarantee.

**`.trim()` applied again when passing** — so the stored title has no leading/trailing whitespace. Called twice (once to test, once to pass) rather than hoisted to a local; negligible.

**`setlists = [s, ...setlists]`** — prepend, matching `listSetlists`' `ORDER BY created_at DESC`. **An optimistic local insert rather than a refetch**, and it works because [`createSetlist`](../lib/setlists.ts.md) returns the complete constructed object including `noteCount: 0`. Same pattern as `FeedPage`'s handlers.

**Reassignment, not `.unshift()`** — the Svelte 5 idiom used consistently in this codebase.

**All four resets are inside the `try`, after the await** — so a failed create leaves the form open with the user's text intact. Putting them in `finally` would clear the form on failure and lose the input. Correct placement, and the same reasoning as `FeedPage`'s `loadError = null`.

**`finally { saving = false }`** — the button re-enables on both paths.

---

## `handleDelete`

```ts
async function handleDelete(id: string, title: string) {
  if (!confirm(`Delete setlist "${title}"?`)) return;
  await deleteSetlist(id);
  setlists = setlists.filter((s) => s.id !== id);
  toast.success("Setlist deleted");
}
```

**Takes `title` purely for the confirmation message** — the alternative would be looking it up from `id` inside the function, and the template already has it to hand.

**`confirm()`** — the fourth native dialog in the app, consistently reserved for destructive actions.

**Note the message doesn't say what's lost.** `NotePage`'s delete adds *"This cannot be undone."*; this one doesn't, and more usefully it doesn't mention that the **songs are not deleted** — only the grouping. Given [`deleteSetlist`](../lib/setlists.ts.md) removes `setlist_items` rows, a user could reasonably fear losing the songs. The same reassurance `SettingsPage`'s import confirm gets right ("Nothing else is deleted") is missing here.

**No `try`/`catch`** — a failed delete throws unhandled, and the card stays on screen with no explanation. The optimistic `filter` only runs after the `await`, so at least the UI won't lie about a failed delete.

---

## The template

### The create toggle

```svelte
<Button onclick={() => (creating = !creating)}>
  <Plus /> New setlist
</Button>
```

**Toggles**, so pressing it again collapses the form. But the label and icon stay "New setlist" / `Plus` in both states, so an open form's toggle button reads as though it would open a second one. A small affordance gap — the empty state's button below correctly uses `= true` instead.

### The create form

```svelte
{#if creating}
  <Card class="mb-6 p-5"> … </Card>
{/if}
```

**`{#if}`, not a CSS toggle** — the form is removed from the DOM when closed, so its inputs can't be tabbed into. Correct for a form; contrast `NotePage`'s duplicated action rows, which use `sm:hidden` because both must exist for CSS to choose between them.

```svelte
<Button disabled={saving || !newTitle.trim()} onclick={handleCreate}>
  {saving ? "Creating…" : "Create setlist"}
</Button>
```

**Two disable reasons in one expression** — mid-save, or no title. The `!newTitle.trim()` re-evaluates reactively as the user types, so the button enables on the first non-space character.

**`disabled` + label swap**, the same idiom as `SettingsPage` (and different from `FeedPage`'s `loading` prop).

```svelte
<div class="flex flex-col-reverse gap-2 sm:flex-row">
```

**`flex-col-reverse` on phones** — Cancel is written *after* Create in the markup but renders *above* it. So the primary action sits at the bottom of the stack, nearest the thumb. On desktop `sm:flex-row` restores source order, putting Create on the left. **Source order stays correct for keyboard and screen-reader users while the visual order suits each device** — a genuinely thoughtful use of a flex direction, and the kind of thing that's invisible until you notice the class.

### The three-state list

```svelte
{#if loading}
  <p class="text-sm text-muted-foreground">Loading…</p>
{:else if setlists.length === 0}
  … empty state …
{:else}
  … grid …
{/if}
```

**A plain "Loading…" paragraph**, where `FeedPage` renders a skeleton and a `role="status"` live region. Less polished, and it's the same page that lacks an error state — the setlists route is generally a tier below the feed in finish.

**The empty state is hand-rolled** here (`rounded-xl border border-dashed …`) rather than using the [`EmptyState`](../components/ui/EmptyState.svelte.md) component that `FeedPage` uses for its error. So there are two empty-state implementations in the codebase.

```svelte
<div class="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
  {#each setlists as s (s.id)}
```

**Responsive grid: 1 → 2 → 3 columns.** Keyed by `s.id` — necessary because `handleDelete` and `handleCreate` both reorder the array.

### The card's split interaction

```svelte
<Card class="group/sl gap-0 py-0 hover:ring-primary/40">
  <a href={`#/setlists/${s.id}`} onclick={(e) => goto(`/setlists/${s.id}`, e)} class="focus-ring block rounded-t-xl">
    <CardContent> … </CardContent>
  </a>
  <CardFooter>
    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
    <button onclick={() => handleDelete(s.id, s.title)} aria-label="Delete setlist"> <Trash2 /> </button>
  </CardFooter>
</Card>
```

**The card is deliberately *not* one big link.** The body is an `<a>`; the footer holds a `<button>`. Nesting interactive elements is invalid HTML and produces genuinely broken behaviour — clicking Delete would also follow the link.

Splitting them means only the content area navigates, and the delete button is a sibling. **This is the correct solution to the "clickable card with an action button" problem**, and worth recognising: the alternative (a card-wide click handler plus `e.stopPropagation()` on the button) is more common and worse for keyboard and screen-reader users.

**`href` + `onclick={… goto(path, e)}`** — the same dual binding as `FeedPage`. `href` for native anchor behaviour, `goto(e)` for the nav-stack invariant, and `isNavClick` inside `goto` decides which wins. See [`nav-stack.svelte.ts`](../lib/nav-stack.svelte.ts.md).

**`class="focus-ring block rounded-t-xl"`** — `focus-ring` is the custom utility from [`globals.css`](../app/globals.css.md), giving keyboard focus a visible ring. **`block`** is required: an inline `<a>` wrapping a block-level `CardContent` produces broken layout and a focus ring that doesn't match the clickable area.

**`group/sl` + `group-hover/sl:text-primary`** — Tailwind's *named* group. The `/sl` suffix scopes it, so nested groups (a card inside a card) don't trigger each other. Hovering anywhere on the card tints the title, which tells the user the whole body is one target.

```svelte
{s.noteCount ?? 0} {(s.noteCount ?? 0) === 1 ? "song" : "songs"}
```

**`?? 0` twice** — `noteCount` is optional on [`Setlist`](../lib/types.ts.md) because only `listSetlists` supplies it. The fallback is defensive; this page always gets it. Two identical fallbacks in one line would be better as a `{@const}`.

**This is the number the orphan-purge in [`db-driver.ts`](../lib/db-driver.ts.md) exists to keep honest** — the "8 songs over 7 rows" bug was this exact `<span>` disagreeing with the setlist detail page.

```svelte
{new Date(s.createdAt).toLocaleDateString()}
```

**`toLocaleDateString()` with no arguments** — uses the browser locale and default format. So the same setlist shows `8/27/2026` or `27/08/2026` depending on the machine. Fine for a personal app.

**`sm:-mr-1 sm:size-7` vs `-mr-1.5 size-9`** on the delete button — a 36px touch target on phones shrinking to 28px on desktop. Below the 44px WCAG recommendation but a deliberate accommodation, and the same instinct as the `pointer: coarse` slider sizing in `globals.css`.

**`aria-label="Delete setlist"`** — the button has only an icon, so it needs an accessible name. Note it doesn't include the title, so a screen reader user hears the same label on every card. `aria-label={\`Delete ${s.title}\`}` would be better.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `try`/`finally`, **no** `catch` | `onMount` | Spinner always clears; error goes unhandled to the console |
| `if (!newTitle.trim()) return` | `handleCreate` | Guard even though the button is also `disabled` |
| `[s, ...setlists]` | `handleCreate` | Optimistic prepend, matching `ORDER BY created_at DESC` |
| resets **inside** `try`, after `await` | `handleCreate` | A failed create keeps the user's input |
| `confirm()` before the delete | `handleDelete` | Destructive-action convention |
| `filter` **after** the `await` | `handleDelete` | Don't remove the card until the delete succeeded |
| `creating = !creating` vs `= true` | header vs empty state | Toggle in one place, open in the other |
| `{#if creating}` not CSS | create form | Removed from the DOM so it can't be tabbed into |
| `disabled={saving \|\| !newTitle.trim()}` | create button | Two reasons, one expression |
| `flex-col-reverse … sm:flex-row` | form buttons | Primary nearest the thumb; source order stays correct |
| `<a>` and `<button>` as **siblings** | card | Nested interactive elements are invalid and break |
| `focus-ring block` | card link | `block` is required for a correct focus ring on block content |
| `group/sl` named group | card | Scoped hover so nested groups don't cross-trigger |
| `?? 0` ×2 | note count | `noteCount` is optional on the type |
| `{#each … (s.id)}` | grid | The array is reordered by create and delete |

---

## Known rough edges

1. **No error state** — a failed load reads as "No setlists yet."
2. **No `try`/`catch` on delete** — a failure is silent.
3. **The delete confirm doesn't say the songs are kept**, which is the thing a user would fear.
4. **A hand-rolled empty state** rather than the `EmptyState` component used elsewhere.
5. **`aria-label` doesn't name the setlist** — every delete button sounds identical.
6. **The "New setlist" toggle keeps its label** when the form is already open.

---

## Related

- [`lib/setlists.ts`](../lib/setlists.ts.md) — `listSetlists`, `createSetlist`, `deleteSetlist`
- [`pages/SetlistPage.svelte`](SetlistPage.svelte.md) — the detail route this links to
- [`lib/db-driver.ts`](../lib/db-driver.ts.md) — the orphan purge that keeps `noteCount` honest
- [`pages/FeedPage.svelte`](FeedPage.svelte.md) — the same list-page shape, more thoroughly finished
