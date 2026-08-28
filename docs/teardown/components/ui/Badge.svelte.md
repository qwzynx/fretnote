# `src/components/ui/Badge.svelte`

**Role:** A small pill label — chord names, keys, note type, capo. **Size:** 42 lines.
**Depends on:** `class-variance-authority`, `@/lib/utils`.

**The first component using `cva`**, the variant pattern that [`Button.svelte`](Button.svelte.md) uses at much larger scale. Read this one first — same idea, a quarter the size.

## `cva(base, config)`

```ts
const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground",
        secondary:   "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline:     "border-border text-foreground",
        ghost:       "hover:bg-muted hover:text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
```

**`cva` returns a function.** Calling `badgeVariants({ variant: "secondary" })` produces the base string concatenated with that variant's string. `defaultVariants` fills in an omitted key.

**Why not a plain `Record<Variant, string>` lookup:** at this size a record would do. `cva` earns its place when there are *multiple* independent axes (Button has `variant` × `size`), where a record would need a cartesian product. Using it here keeps the two components structurally identical.

**The output still goes through `cn`:**

```svelte
<span class={cn(badgeVariants({ variant }), className)} {...rest}>
```

`cva` **concatenates**; it has no idea that `bg-primary` and a caller's `bg-red-500` conflict. `twMerge` inside [`cn`](../../lib/utils.ts.md) resolves that, and the caller's `className` last means the caller wins. **The two libraries do different jobs and both are needed.**

## The base string, read in groups

**`inline-flex … items-center justify-center gap-1`** — a flex row so a badge can hold an icon plus text with even spacing. `NotePage` uses exactly this: `<Guitar class="size-3" /> Tab`.

**`h-5` (20px) with `py-0.5`** — a fixed height, so a row of badges aligns regardless of content. Fixed height plus `items-center` is what keeps a badge with an icon the same height as one without.

**`w-fit`** — shrink to content. Necessary because `inline-flex` inside a flex parent would otherwise stretch.

**`shrink-0`** — a badge must never be compressed by a flex parent. Same reasoning as `Separator`'s.

**`rounded-full`** — the pill shape, not a token from the radius scale. Correct: `rounded-full` is `9999px`, an "always a semicircle" value that isn't part of a proportional ramp.

**`border border-transparent`** is the subtle one. A **transparent** border is declared in the *base*, so every variant reserves the same 1px. The `outline` variant then only has to set `border-border` — a colour change, not a width change, so **the badge doesn't grow by 2px when it becomes an outline badge**. Without this, outline and filled badges in the same row would be different sizes. A small trick worth recognising; the same idea appears throughout well-built design systems.

**`whitespace-nowrap`** — a chord name like `F#sus4` must never wrap mid-symbol.

**`overflow-hidden`** — clips content to the rounded shape.

**`[&>svg]:pointer-events-none [&>svg]:size-3`** — arbitrary-variant selectors targeting direct `<svg>` children. `size-3` (12px) sizes any Lucide icon automatically, so call sites needn't. `pointer-events-none` stops the icon swallowing clicks intended for a parent.

Note `NotePage` still writes `<Guitar class="size-3" />` explicitly despite this rule — redundant, and it works either way since both say `size-3`.

## The five variants

| Variant | Fill | Use |
|---|---|---|
| `default` | solid `--primary` | The loudest; rarely used |
| `secondary` | `--surface-3` | Key, chord chips — the workhorse |
| `destructive` | `bg-destructive/10` + `text-destructive` | Tinted, not solid |
| `outline` | transparent + visible border | Type badge, "sounds like" |
| `ghost` | nothing until hover | Interactive-looking badges |

**`destructive` uses a 10% tint rather than a solid fill** — the pattern of every "soft" style in this app (compare `Button`'s `destructive-soft`). A solid red badge would shout; a tint reads as a status.

**`ghost` has *only* hover styles** — invisible at rest. It's the one variant that implies interactivity, which sits oddly on a `<span>`; nothing in the codebase appears to use it.

## `<span>`, not `<div>`

Badges appear inline with text and inside `<p>` elements, where a `<div>` would be invalid HTML. `inline-flex` gives flex layout without leaving the inline flow.

## Control flow

No conditionals, no loops. Branching is entirely inside `cva`'s lookup and `twMerge`'s conflict resolution.

---

## Related
- [`Button.svelte`](Button.svelte.md) — the same `cva` pattern with two axes
- [`lib/utils.ts`](../../lib/utils.ts.md) — why `cn` must wrap `cva`'s output
- [`app/globals.css`](../../app/globals.css.md) — every colour token used here
- [`pages/NotePage.svelte`](../../pages/NotePage.svelte.md) — the heaviest consumer
