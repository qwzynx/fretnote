# `src/components/KeyboardShortcutsHelp.svelte`
**Role:** The `?` shortcuts reference dialog. **116 lines.**

## Data
Three arrays — `GLOBAL`, `READER`, `EDITOR` — each `{ keys: string[], desc: string }`. `keys` is an array so a chord renders as separate `<kbd>` elements (`Ctrl` + `N`).

**These are documentation, not bindings.** Nothing here registers a shortcut; the actual handlers live in [`App.svelte`](../App.svelte.md) (global), `NoteReader` (reader), and `CreateNoteForm` (editor). **So this list can silently drift out of date** — it's a hand-maintained mirror of behaviour defined in three other files. Worth spot-checking against them.

## `historyLayer(() => open, () => onclose())`
Registers with [`overlay-history`](../lib/overlay-history.svelte.ts.md) so the Android back button closes it.

**Note the ordering problem this creates with `App.svelte`:** that file's Escape handler calls `closeTopLayer()`, which *will* now find this layer and close it — so Escape works. But `App.svelte` also opens this dialog by setting a plain `shortcutsOpen = true`, and the `historyLayer` effect pushes the history entry in response. The two are consistent, just split across files.

## `handleKeydown`
```ts
function handleKeydown(e: KeyboardEvent) { if (e.key === "Escape") onclose(); }
```
Bound to the backdrop. **Note it does *not* `stopPropagation`**, unlike [`SearchPalette`](SearchPalette.svelte.md) — so Escape here also reaches `App.svelte`'s global handler, which calls `closeTopLayer()`. Both close the dialog; the second is a harmless no-op because the layer is already gone. Redundant rather than buggy.

**The backdrop has `onkeydown` but no `tabindex="-1"`**, unlike `NotePage`'s action sheet — so the div can't receive focus and this handler will rarely fire. Escape works via `App.svelte`'s window listener instead.

## Template
- **`role="dialog" aria-modal="true" aria-label`** — the correct ARIA trio (which `SearchPalette` is missing).
- **`e.target === e.currentTarget`** backdrop-only close.
- **Three near-identical `{#each}` blocks**, one per group, with the same 8 lines of markup repeated. A `{#snippet section(title, items)}` would collapse them — the clearest duplication in the codebase.
- **Nested `{#each s.keys as k}`** renders each key as its own `<kbd>`.
- **`bg-scrim`** — the token added to replace four copies of `bg-black/60`.
- **No `dragDismiss`**, no phone sheet variant, no `max-h`/scroll — this is a desktop-shaped dialog, consistent with the fact that `?` is a keyboard-only trigger.
- **The Mac note at the bottom** compensates for the list hardcoding `Ctrl`, while `App.svelte` actually accepts `e.ctrlKey || e.metaKey`.
- **No focus trap and no focus restore** — `aria-modal="true"` asserts modality that isn't enforced.

**Related:** [`App.svelte`](../App.svelte.md) — binds `?` and owns the global shortcuts this documents; [`lib/overlay-history.svelte.ts`](../lib/overlay-history.svelte.ts.md)
