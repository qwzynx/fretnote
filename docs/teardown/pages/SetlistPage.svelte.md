# `src/pages/SetlistPage.svelte`

**Role:** The setlist detail route (`/setlists/:id`). Editable title, an ordered song list with reorder/remove, and a prev/next performance navigator.
**Size:** 322 lines. **Route:** `/setlists/:id`

---

## State

```ts
let setlist = $state<SetlistWithNotes | null | undefined>(undefined);
let editingTitle = $state(false);
let titleDraft = $state("");
let currentIdx = $state(0);
let labelOffset = $state(0);
```

**The same three-state `undefined | null | Data`** as [`NotePage`](NotePage.svelte.md) — loading / not-found / loaded, distinguished by `===` in the template.

**`titleDraft` is a separate draft buffer**, not a direct bind to `setlist.title`. That's what makes Cancel work: binding the input straight to the model would apply every keystroke immediately and leave nothing to revert to.

**`currentIdx` is the performance cursor** — which song you're on during a gig. Purely local; nothing persists it.

**`labelOffset` is a drag-feedback value**, described below.

---

## `NoteWithItemId` — the type-lie workaround

```ts
type NoteWithItemId = Note & { _itemId: string };
```

**This is the other half of the smuggle described in [`setlists.ts`](../lib/setlists.ts.md).** That module attaches `_itemId` to each note and casts the array back to `Note[]`, so the declared type doesn't mention it. Every use site here must cast it back:

```ts
(note as NoteWithItemId)._itemId
(setlist.notes as NoteWithItemId[]).filter(...)
```

**Five casts in one file**, all recovering information the type deliberately discards. The honest model — `SetlistEntry { note: Note; itemId: string }` — would remove every one. Worth recognising as a place where following the types actively misleads you.

**Why `_itemId` is needed at all:** removal and reordering operate on the *membership row*, not the note. The same song can be in several setlists, so `note.id` doesn't identify which row to touch.

---

## The prev/next drag feedback

```ts
function handleSongDragMove(dx: number) {
  if (!setlist) return;
  const atStart = currentIdx === 0 && dx > 0;
  const atEnd = currentIdx === setlist.notes.length - 1 && dx < 0;
  if (atStart || atEnd) return;
  labelOffset = Math.max(-24, Math.min(24, dx * 0.3));
}
```

**`dx * 0.3` — rubber-band resistance.** The label follows the finger at 30% speed, so the gesture is acknowledged without the label sliding out of its box. A standard "this is draggable but constrained" cue.

**`Math.max(-24, Math.min(24, …))` — a clamp to ±24px.** Note the nesting order: `min` caps the top, `max` raises the floor. Equivalent to the `clamp` helper in [`fingering.ts`](../lib/music/fingering.ts.md), written inline.

**The `atStart` / `atEnd` guards are the interesting part.** Each combines a boundary with a *direction*:

- `currentIdx === 0 && dx > 0` — at the first song, dragging right (toward "previous"). Nothing there.
- `currentIdx === last && dx < 0` — at the last song, dragging left (toward "next").

Returning early leaves `labelOffset` at `0`, so the label **doesn't move at all** in a direction that can't go anywhere. That's the correct feedback: the absence of movement says "this is the end" more clearly than a rubber-band would. Note the opposite direction still works at each boundary, because the condition requires both.

```ts
function handleSongCommit(direction: "left" | "right") {
  if (!setlist) return;
  if (direction === "left" && currentIdx < setlist.notes.length - 1) currentIdx += 1;
  else if (direction === "right" && currentIdx > 0) currentIdx -= 1;
  labelOffset = 0;
  const itemId = (setlist.notes[currentIdx] as NoteWithItemId)?._itemId;
  if (itemId) {
    document.querySelector(`[data-item-id="${itemId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}
```

**Left = next, right = previous** — matching the physical metaphor of pushing content leftward to advance. Each branch re-checks the bound, so a committed swipe at the end is a no-op rather than an out-of-range index.

**`labelOffset = 0` unconditionally**, so the label snaps back whether or not the index changed.

**The `scrollIntoView` is the useful bit:** advancing the cursor scrolls the corresponding row in the list above into view. Without it, the ring highlight would move off-screen during a long setlist and the navigator would feel disconnected from the list.

**`document.querySelector` with a data attribute** rather than a `bind:this` array — a direct DOM query from a component, which is unusual for this codebase. Justified: binding refs for every row and indexing them would be more machinery for a one-off scroll. The `data-item-id` attribute on the row is placed specifically for this.

**`block: "nearest"`** — scrolls the minimum distance to bring the row into view, rather than centring it. Avoids jarring jumps when the row is already almost visible.

**No escaping on the interpolated `itemId`** — safe because ids are UUIDs, but a CSS-selector injection in principle.

**The `?.` chains** guard an empty list and a missing element.

### Wiring

```svelte
use:swipeHorizontal={{
  directions: "both",
  enabled: () => isTouch.current,
  onDragMove: handleSongDragMove, onCommit: handleSongCommit, onCancel: handleSongCancel,
}}
```

**`directions: "both"`**, unlike `NotePage`'s `"right"`-only back gesture — here both directions are meaningful. **No `distanceThreshold`**, so it uses the 80px default; song-stepping is a smaller, more repeatable gesture than page-dismissal.

**Attached to the navigator bar only**, not to `<main>` — so the swipe is scoped to that control and doesn't fight page scrolling or conflict with `NotePage`'s back-swipe idiom.

---

## Data operations

```ts
onMount(async () => {
  setlist = await getSetlistWithNotes(params.id);
  titleDraft = setlist?.title ?? "";
});
```

**`titleDraft` seeded from the loaded title**, so opening the editor starts from the current value rather than empty. `?? ""` handles the not-found case.

**`params.id` read once, not `$derived`** — the same latent staleness as `NotePage`. Navigating between two setlists without unmounting wouldn't reload.

```ts
async function saveTitle() {
  if (!setlist || !titleDraft.trim()) return;
  await updateSetlist(setlist.id, titleDraft.trim(), setlist.description);
  setlist = { ...setlist, title: titleDraft.trim() };
  editingTitle = false;
  toast.success("Title updated");
}
```

**`!titleDraft.trim()` rejects a whitespace-only title** — but silently, with no message and with the editor left open. The Save button isn't disabled either, so pressing it appears to do nothing.

**`setlist.description` is passed through unchanged** — [`updateSetlist`](../lib/setlists.ts.md) takes both fields, and there's no description editor on this page, so the current value is echoed back. **A read-modify-write with no locking:** if the description were edited elsewhere between load and save, this would revert it. Not reachable today.

**`{ ...setlist, title }` — an optimistic local update**, avoiding a refetch. Reassignment rather than mutation, per the codebase idiom.

**No `try`/`catch`** — a failed update throws unhandled, and the UI would show the new title anyway (the local update happens after the await, so actually it wouldn't — the throw skips it). Correct by accident.

```ts
async function handleRemoveNote(itemId: string) {
  if (!setlist) return;
  await removeFromSetlist(itemId);
  const notes = (setlist.notes as NoteWithItemId[]).filter((n) => n._itemId !== itemId);
  setlist = { ...setlist, notes, noteCount: notes.length };
  if (currentIdx >= notes.length) currentIdx = Math.max(0, notes.length - 1);
}
```

**Filters by `_itemId`, not `note.id`** — correct, since removal targets the membership row.

**`noteCount: notes.length` is updated alongside** — keeping the denormalised count in step with the array it summarises. The same field the orphan-purge in [`db-driver.ts`](../lib/db-driver.ts.md) exists to keep honest.

**`if (currentIdx >= notes.length) currentIdx = Math.max(0, notes.length - 1)`** — the cursor-clamp, and it's the reason this function is more than a filter. Removing the song you're currently on (or any song before it) would leave `currentIdx` pointing past the end, and the navigator would render `undefined`. `Math.max(0, …)` handles removing the last song entirely, where `length - 1` is `-1`.

**No confirmation** — unlike deleting a setlist or a note. Right call: removing a song from a setlist is trivially reversible.

```ts
async function handleMove(itemId: string, direction: "up" | "down") {
  if (!setlist) return;
  await moveSetlistItem(setlist.id, itemId, direction);
  setlist = await getSetlistWithNotes(setlist.id) ?? setlist;
}
```

**The one operation that refetches instead of updating locally.** Justified: [`moveSetlistItem`](../lib/setlists.ts.md) swaps two `position` values in the database, and reproducing that reordering in memory means duplicating the swap logic — including its bounds handling. Refetching is one line and cannot drift from the source of truth.

**`?? setlist`** — if the refetch returns `null` (the setlist was deleted concurrently), keep the current value rather than blanking the page.

**`currentIdx` is *not* adjusted after a move** — so reordering songs leaves the cursor pointing at whatever now occupies that index, which may be a different song. Arguably wrong; arguably fine, since the cursor is a position in the running order rather than a bookmark on a song.

---

## The template

### The inline title editor

```svelte
{#if editingTitle}
  <Input bind:value={titleDraft} class="min-w-0 flex-1 text-lg font-semibold sm:text-xl" />
  <Button size="sm" onclick={saveTitle}>Save</Button>
  <Button variant="ghost" size="sm" onclick={() => (editingTitle = false)}>Cancel</Button>
{:else}
  … title + pencil button …
{/if}
```

**Cancel simply flips the flag** without resetting `titleDraft`. So cancelling an edit and re-opening it shows the abandoned text, not the saved title. A small bug: `titleDraft = setlist.title` in the cancel handler would fix it.

**`min-w-0 flex-1`** on the input — `min-w-0` again, this time to let a flex item shrink below its intrinsic width so the buttons aren't pushed out. Third appearance of this fix in the codebase.

**No Enter-to-save and no autofocus** — the editor requires a mouse or a tab to reach Save.

**`truncate` on the `<h1>`** with `min-w-0` on its wrapper — the same pair, so a long title ellipsises rather than pushing the pencil button off-screen.

### The song rows

```svelte
{#each setlist.notes as note, i ((note as NoteWithItemId)._itemId)}
  {@const itemId = (note as NoteWithItemId)._itemId}
```

**Keyed by `_itemId`, not `note.id`** — and this is the correct choice. A note *could* legitimately appear twice in one setlist (play the opener again as an encore), and `note.id` would then be a duplicate key. The membership id is unique per row.

**`{@const}` hoists the cast** so the four handlers below don't each repeat it.

```svelte
class="… {i === currentIdx ? 'ring-2 ring-primary' : ''}"
```

**The current-song highlight**, string-interpolated into the class list. Note this bypasses `cn()`/`twMerge`, so there's no conflict resolution — fine, since nothing else in the string sets a ring.

```svelte
data-item-id={itemId}
```

**The scroll target** `handleSongCommit` queries for.

```svelte
class="flex flex-wrap items-center gap-x-3 gap-y-2 … sm:flex-nowrap"
```

> *"Phones: song info on top, controls on their own full-width row."*

**`flex-wrap` + `w-full` on the controls div** is the mechanism: on phones the control group's `w-full` forces it onto its own line, and `flex-wrap` allows the wrap. At `sm:` the parent becomes `flex-nowrap` and the controls become `sm:w-auto`, so everything sits on one row. **Two layouts from two class pairs, with no media-query JavaScript** — the same CSS-first principle as `NotePage`'s duplicated action rows, but achieved without duplicating markup.

```svelte
<a href={`#/notes/${note.id}`} onclick={(e) => goto(`/notes/${note.id}`, e)} class="focus-ring min-w-0 flex-1 rounded-md">
```

**The title/artist block is the link**, sitting as a sibling to the buttons rather than wrapping them — the same anchor-and-button-as-siblings pattern as [`SetlistsPage`](SetlistsPage.svelte.md), for the same reason (nested interactive elements are invalid HTML).

**There is a second "Open" link** in the controls row pointing at the same URL. Redundant on desktop, but on phones the title block is small and the explicit button is a clearer target.

```svelte
<button disabled={i === 0} aria-label="Move up" class="… disabled:opacity-30 …">
<button disabled={i === setlist.notes.length - 1} aria-label="Move down">
```

**Bounds expressed as `disabled`** rather than hidden, so the button positions stay stable down the list. `disabled:opacity-30` gives the visual cue. [`moveSetlistItem`](../lib/setlists.ts.md) *also* bounds-checks, so this is defence in depth.

**`size-9 … sm:size-7`** on all four buttons — 36px touch targets shrinking to 28px on desktop, the same accommodation as `SetlistsPage`.

**`aria-label` on each icon button**, but none names the song — every row announces "Move up", "Remove from setlist". Same gap as `SetlistsPage`.

### The navigator

```svelte
<div class="min-w-0 text-center transition-transform duration-150"
     style="transform: translateX({labelOffset}px)">
```

**An inline `style` with an interpolated reactive value** — the only way to apply a continuously-varying transform, since Tailwind classes are static strings. Note the `transition-transform duration-150`: during a drag the value updates every frame so the transition barely registers, but on release (`labelOffset = 0`) it animates the snap-back. **One class serving both the drag and the release** — no need to disable the transition mid-gesture as [`drag-dismiss`](../lib/actions/drag-dismiss.ts.md) does, because 150ms at 30% resistance is imperceptible.

```svelte
<Button disabled={currentIdx === 0} onclick={() => (currentIdx = Math.max(0, currentIdx - 1))}>
<Button disabled={currentIdx === setlist.notes.length - 1}
        onclick={() => (currentIdx = Math.min(setlist!.notes.length - 1, currentIdx + 1))}>
```

**Both `disabled` *and* clamped** — the same belt-and-braces as the move buttons.

**`setlist!` — a non-null assertion** inside the second handler. Needed because the closure escapes the `{:else}` branch's narrowing, exactly as in [`NotePage`](NotePage.svelte.md). There the fix was `{@const noteId = note.id}`; here it's a `!`. Two solutions to the same problem in one codebase — the `{@const}` form is the safer one.

**`{setlist.notes[currentIdx]?.title ?? ""}`** — optional chaining plus a fallback for an empty list, though the whole block is inside `{#if setlist.notes.length === 0}`'s else branch and can't be empty. Defensive.

**`{currentIdx + 1} / {setlist.notes.length}`** — 1-based for display, 0-based internally. The standard split.

```svelte
{@const currentNoteId = setlist.notes[currentIdx]?.id}
<a href={`#/notes/${currentNoteId}`} …>Open "{setlist.notes[currentIdx]?.title}"</a>
```

**`{@const}` for the id but not the title** — inconsistent; the title is re-indexed inline. Harmless, but the `{@const}` was presumably added only where TypeScript complained.

### The empty states

```svelte
<p class="text-sm text-muted-foreground">No songs yet. Add songs from their note page.</p>
```

**Tells the user where the action lives** — songs are added from `NotePage`'s "Add to setlist", not from here. Without that sentence the empty state would be a dead end, since this page offers no way to add anything.

**Hand-rolled again** rather than using [`EmptyState`](../components/ui/EmptyState.svelte.md) — the third empty-state implementation in the codebase.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `undefined \| null \| Data` | state | Loading / not-found / loaded in one variable |
| `titleDraft` separate from `setlist.title` | state | A draft buffer is what makes Cancel possible |
| `atStart` / `atEnd` guards | `handleSongDragMove` | No movement at all in a direction that can't advance |
| `dx * 0.3`, clamped ±24 | `handleSongDragMove` | Rubber-band acknowledgement without sliding out of the box |
| bounds re-checked in commit | `handleSongCommit` | A committed swipe at the end is a no-op |
| `querySelector([data-item-id])` | `handleSongCommit` | Scroll the list to follow the cursor |
| `block: "nearest"` | `scrollIntoView` | Minimum movement, no jarring recentre |
| `if (currentIdx >= notes.length)` | `handleRemoveNote` | Clamp the cursor after removing the current song |
| `Math.max(0, length - 1)` | `handleRemoveNote` | Removing the last song gives `-1` |
| refetch instead of local update | `handleMove` | Don't reimplement the position swap in memory |
| `?? setlist` | `handleMove` | A concurrent delete mustn't blank the page |
| keyed by `_itemId` | `{#each}` | The same note can legitimately appear twice |
| `flex-wrap` + `w-full` → `sm:flex-nowrap` | rows | Two layouts, no duplicated markup |
| `<a>` and buttons as siblings | rows | Nested interactive elements are invalid |
| `disabled` **and** clamped handlers | move / prev / next | Defence in depth against the ends |
| inline `style` + `transition-transform` | navigator label | One class serves both drag and snap-back |
| `setlist!` non-null assertion | next button | Narrowing doesn't survive into a closure |

---

## Known rough edges

1. **Five `as NoteWithItemId` casts** working around a type the data layer deliberately narrows.
2. **Cancel doesn't reset `titleDraft`** — abandoned text reappears on the next edit.
3. **Empty-title save fails silently** with the button still enabled.
4. **No `try`/`catch` on any write.**
5. **`currentIdx` isn't adjusted after a reorder.**
6. **`params.id` isn't `$derived`** — a route change without unmount wouldn't reload.
7. **`aria-label`s don't name the song.**

---

## Related

- [`lib/setlists.ts`](../lib/setlists.ts.md) — every query here, and the `_itemId` smuggle
- [`lib/actions/swipe-horizontal.ts`](../lib/actions/swipe-horizontal.ts.md) — the navigator gesture
- [`pages/NotePage.svelte`](NotePage.svelte.md) — where songs are added to setlists
- [`pages/SetlistsPage.svelte`](SetlistsPage.svelte.md) — the index this returns to
