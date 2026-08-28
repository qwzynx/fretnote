# `src/components/ui/CardContent.svelte`

**Role:** The padded body region of a card. **Size:** 18 lines.

```svelte
<div class={cn("p-4", className)} {...rest}>
  {@render children?.()}
</div>
```

**Identical in structure to [`Card.svelte`](Card.svelte.md)** — same prop destructuring, same `...rest` forwarding, same `{@render children?.()}`. Read that file for the pattern; only the class string differs.

## Why a component for `p-4`

It's one utility class. A caller could write `<div class="p-4">` and save a file.

The justification is **naming, not styling**. `<CardContent>` states the role of the region, so `Card` / `CardContent` / `CardFooter` read as a structure rather than as three anonymous divs. It also gives the padding **one place to change** — adjusting card padding app-wide is a single edit here rather than a search for every `p-4` that happens to be inside a card.

This is the shadcn/ui convention, which the whole `ui/` directory follows. The tradeoff is real: four files and four imports for what CSS could express in one class. It pays off at scale and looks like overhead at this one.

## `p-4` vs `CardFooter`'s `px-4 py-2.5`

The footer is deliberately tighter vertically — it holds a metadata line and an icon button, not prose. Consistent horizontal padding (`px-4`) keeps content aligned in a vertical line down the card; only the vertical rhythm differs.

## Control flow

None.

---

## Related
- [`Card.svelte`](Card.svelte.md) — the full annotation of this pattern
- [`CardFooter.svelte`](CardFooter.svelte.md)
- [`pages/SetlistsPage.svelte`](../../pages/SetlistsPage.svelte.md) — the only consumer of all three
