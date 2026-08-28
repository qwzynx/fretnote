# `src/components/ui/Card.svelte`

**Role:** The card container primitive — a rounded, bordered surface. **Size:** 24 lines.

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  let { class: className = "", children, ...rest }: {
    class?: string; children?: Snippet; [key: string]: unknown;
  } = $props();
</script>

<div class={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:ring-1 hover:ring-border", className)} {...rest}>
  {@render children?.()}
</div>
```

## The wrapper-component pattern

This file, [`CardContent`](CardContent.svelte.md), [`CardFooter`](CardFooter.svelte.md), and [`Label`](Label.svelte.md) are **the same 20 lines with a different class string and tag**. Learn the shape once and four files become trivial.

### `class: className = ""`

**Destructuring with a rename**, because `class` is a reserved word in JavaScript and can't be a binding name. The prop is still spelled `class` by callers — `<Card class="mb-6 p-5" />` — which is what keeps the component feeling like a plain element.

Defaulting to `""` means `cn()` never receives `undefined`. (It handles `undefined` fine; the default is for tidiness.)

### `...rest` and `{...rest}`

**Collects every other attribute and forwards it to the DOM node.** So `<Card id="x" data-foo="y" onclick={…} />` works without the component declaring any of those props. This is what makes a wrapper component *transparent* — it adds styling without taking anything away.

**`[key: string]: unknown`** in the type is the index signature that permits arbitrary props. It's loose — `<Card typoedProp={1} />` compiles — which is the accepted cost of transparency.

**Placement matters:** `{...rest}` comes **after** `class={…}`, so a caller passing `class` through `rest`… can't, because `class` was already destructured out. The ordering protects against `rest` clobbering the computed class.

### `children?: Snippet` and `{@render children?.()}`

**Svelte 5's replacement for slots.** Content between `<Card>` and `</Card>` arrives as a `Snippet` — a renderable function — and `{@render}` invokes it.

**`?.()`** handles a card with no children, which would otherwise throw.

### `cn(base, className)`

**The caller's classes go last**, so `twMerge` lets them override the defaults on any conflicting property. `<Card class="py-0">` really does beat a base `p-4`. See [`utils.ts`](../../lib/utils.ts.md) for why the order is the whole point.

## The base classes

`rounded-xl` (the `--radius-xl` token, annotated *"cards"* in [`globals.css`](../../app/globals.css.md)), `bg-card` → `--surface-1`, and `text-card-foreground`.

**`hover:ring-1 hover:ring-border`** — a ring rather than a border change, because a ring is drawn outside the box and doesn't shift layout. Changing `border` width on hover would move every child by a pixel.

**`transition-all`** — broad, and slightly wasteful (it transitions properties that never change). `transition-colors` or `transition-shadow` would be tighter.

**The hover ring applies unconditionally**, even to non-interactive cards. `SetlistsPage` overrides it with `hover:ring-primary/40`; a static card gets a hover affordance it doesn't earn.

## Control flow

None. One `?.()` for absent children. The entire component is a styled `<div>` with prop forwarding.

---

## Related
- [`CardContent.svelte`](CardContent.svelte.md), [`CardFooter.svelte`](CardFooter.svelte.md) — the siblings
- [`lib/utils.ts`](../../lib/utils.ts.md) — `cn`
- [`app/globals.css`](../../app/globals.css.md) — `--card`, `--radius-xl`, `--border`
