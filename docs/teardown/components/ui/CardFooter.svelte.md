# `src/components/ui/CardFooter.svelte`

**Role:** The bottom region of a card — metadata plus actions. **Size:** 18 lines.

```svelte
<div class={cn("flex items-center px-4 py-2.5", className)} {...rest}>
  {@render children?.()}
</div>
```

**Structurally identical to [`Card.svelte`](Card.svelte.md)**; see there for the prop pattern.

## The class string

**`flex items-center`** — the only sibling that opts into flex by default, because a footer's job *is* to lay out a row: metadata on one side, actions on the other. `CardContent` stays a plain block because its content varies.

**`px-4`** matches `CardContent`'s horizontal padding, so text lines up vertically down the whole card. **`py-2.5` (10px)** is tighter than the content's `p-4` (16px) — a footer is chrome, not body.

**No border and no background.** `SetlistsPage` adds `border-t bg-muted/30` at the call site rather than baking it in, which is the right split: the separator is a *use* decision, not intrinsic to being a footer. Compare `Card`'s `hover:ring`, which *is* baked in and is arguably the weaker choice.

## Control flow

None.

---

## Related
- [`Card.svelte`](Card.svelte.md), [`CardContent.svelte`](CardContent.svelte.md)
- [`pages/SetlistsPage.svelte`](../../pages/SetlistsPage.svelte.md) — adds `border-t bg-muted/30`
