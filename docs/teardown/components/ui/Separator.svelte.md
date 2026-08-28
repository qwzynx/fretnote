# `src/components/ui/Separator.svelte`

**Role:** A one-pixel divider line, horizontal or vertical. **Size:** 25 lines.

```svelte
let { orientation = "horizontal" as "horizontal" | "vertical", class: className = "" } = $props();
```
```svelte
{#if orientation === "vertical"}
  <div class={cn("inline-block self-stretch w-px bg-border shrink-0", className)}
       role="separator" aria-orientation="vertical"></div>
{:else}
  <div class={cn("h-px w-full bg-border shrink-0", className)}
       role="separator" aria-orientation="horizontal"></div>
{/if}
```

## The one conditional

**`{#if orientation === "vertical"}` — the only branch in any `ui/` primitive.** The two arms aren't a class swap but genuinely different layout strategies:

| | horizontal | vertical |
|---|---|---|
| thickness | `h-px` | `w-px` |
| extent | `w-full` | `self-stretch` |
| display | (block default) | `inline-block` |

**`w-full` vs `self-stretch`** is the substantive difference. A horizontal rule fills its container's width, which `w-full` does in any layout. A vertical rule must match the *height of its flex siblings* — which `h-full` can't do reliably, since the parent's height is often implicit. `self-stretch` sets `align-self: stretch`, making the item span the flex line's cross axis. **This is why the branch can't be collapsed into a ternary on the class string alone** — well, it could, but the pairing of four classes per arm makes two literals clearer.

**`shrink-0`** on both — without it, a flex parent under pressure would compress a 1px divider to 0 and it would vanish. A classic and easily-missed bug.

## `role="separator"` and `aria-orientation`

**An empty `<div>` is invisible to assistive technology.** `role="separator"` gives it the ARIA meaning of a thematic break — the equivalent of `<hr>`, which isn't used here because it carries browser default styling that would have to be reset.

**`aria-orientation`** tells a screen reader which way it runs, meaningful when navigating a toolbar or a menu.

Both are hardcoded per branch rather than interpolated, which keeps each arm self-contained.

## `bg-border`, not a border

A 1px *background* on a zero-height div rather than `border-t`. Equivalent visually; the background approach avoids interacting with the global `* { @apply border-border }` rule in [`globals.css`](../../app/globals.css.md) and makes the thickness explicit in one class.

## No `...rest`

**The only `ui/` primitive that doesn't forward arbitrary attributes**, and it takes no `children`. A divider has no content and nothing to configure beyond orientation and classes. Reasonable, though it means `<Separator id="x">` silently drops the id.

## Control flow summary

| Construct | Purpose |
|---|---|
| `{#if orientation === "vertical"}` | Two genuinely different layout strategies, not a class swap |
| `shrink-0` (both arms) | A flex parent would otherwise crush a 1px divider to nothing |
| `self-stretch` (vertical) | Match sibling height where `h-full` can't |

---

## Related
- [`app/globals.css`](../../app/globals.css.md) — `--border`
- Used by [`NotePage`](../../pages/NotePage.svelte.md), [`SettingsPage`](../../pages/SettingsPage.svelte.md), [`SetlistPage`](../../pages/SetlistPage.svelte.md), [`SetlistsPage`](../../pages/SetlistsPage.svelte.md)
