# `src/components/ui/Button.svelte`

**Role:** The button primitive — 7 variants × 8 sizes, plus a loading state and anchor mode.
**Size:** 130 lines. The largest and most-used `ui/` component.

---

## `cva` with two axes

```ts
const buttonVariants = cva(base, {
  variants: { variant: { …7 }, size: { …8 } },
  defaultVariants: { variant: "default", size: "default" },
});
```

**This is where `cva` earns its place.** [`Badge`](Badge.svelte.md) has one axis and could have used a plain record; here there are 7 × 8 = **56 combinations**, and `cva` composes them from 15 strings instead of enumerating them.

The output still passes through `cn` — `cva` concatenates, `twMerge` resolves conflicts, the caller's `className` goes last and wins. See [`utils.ts`](../../lib/utils.ts.md).

---

## The base string

**`focus-ring`** — uses the shared utility from [`globals.css`](../../app/globals.css.md), correctly (unlike [`Input.svelte`](Input.svelte.md), which respells the ring inline).

**`relative`** — required by the loading overlay, which is `absolute inset-0`.

**`border border-transparent bg-clip-padding`** — the same reserve-the-border trick as `Badge`: every variant carries 1px, so switching to `outline` recolours rather than resizing. **`bg-clip-padding`** additionally stops the background from painting under that transparent border, which would otherwise show as a faint halo on translucent variants like `destructive-soft`.

**`transition-[background-color,color,border-color,box-shadow,translate] duration-fast ease-out`** — an **explicit property list**, not `transition-all` (which `Card` uses). Better: transitioning only what changes avoids the browser animating layout-affecting properties by accident. `duration-fast` and `ease-out` are the motion tokens from `globals.css`, so the button honours the shared motion scale rather than hardcoding a number.

**`active:translate-y-px`** — a 1px press. Cheap, and it's the whole tactile feedback of the app's buttons. Included in the transition list so the release animates back.

**`select-none`** — stops a double-click selecting the label text.

**`disabled:pointer-events-none disabled:opacity-50` *and* `aria-disabled:…`** — the pair matters. A `<button disabled>` responds to the first; an `<a>` **cannot be `disabled`**, so the anchor branch sets `aria-disabled` and these classes give it the same appearance and inertness. Without the `aria-disabled:` variants, a disabled link would look fully live.

**`[&_svg]:pointer-events-none [&_svg]:shrink-0`** — icons never swallow the click, never get squashed by flex.

**`[&_svg:not([class*='size-'])]:size-4`** — the sharpest line in the file. It sizes any descendant `<svg>` to 16px **unless the icon already carries a `size-*` class**. So `<Button><PlusCircle /></Button>` gets the default automatically, while `<Button><Heart class="size-4" /></Button>` keeps its explicit size without a specificity fight. The `:not([class*='size-'])` attribute-substring check is what makes the default *overridable* rather than absolute — and it's why several size variants can restate it at `size-3` / `size-3.5` for smaller buttons.

Note `[&_svg]` (descendant) here vs `Badge`'s `[&>svg]` (direct child) — the looser selector reaches icons wrapped in a span.

---

## The variants

| Variant | Treatment |
|---|---|
| `default` | Solid `--primary` + `shadow-raised` |
| `outline` | Bordered, transparent fill |
| `secondary` | `--surface-3` fill |
| `ghost` | Nothing until hover |
| `destructive` | Solid red + `shadow-raised` |
| `destructive-soft` | `bg-destructive/10` tint |
| `link` | Text-only, underline on hover |

**`hover:bg-primary/85`** — darkening by lowering alpha over the dark ground, rather than naming a second colour. One token covers both states.

**The `destructive` / `destructive-soft` pair** is a deliberate severity split: solid red for a primary destructive action, a 10% tint for a secondary one. [`NotePage`](../../pages/NotePage.svelte.md) and [`SetlistPage`](../../pages/SetlistPage.svelte.md) both use `destructive-soft` for Delete — present, but not shouting.

**`shadow-raised` only on the two solid variants** — the elevation token from `globals.css`, applied where a raised affordance makes sense.

**The `dark:` classes on `outline` and `ghost` never apply** — the app has no `.dark` class on the tree, so per `@custom-variant dark (&:is(.dark *))` they're dead. Scaffold residue, same as `Input`'s `dark:bg-input/30`.

---

## The sizes

```ts
// Touch-first heights that shrink to the dense desktop scale at `sm`.
default: "h-10 gap-1.5 px-3.5 sm:h-8 sm:px-2.5",
sm:      "h-9 … sm:h-7 … sm:text-2xs [&_svg:not([class*='size-'])]:size-3.5",
icon:    "size-10 sm:size-8",
```

**Every size declares a phone height and an `sm:` desktop height** — 40px→32px, 36px→28px, 44px→36px. **Touch-first**, per the comment: the larger value is the *base* and desktop is the override, which is the right default direction for a mobile-primary app.

**Four icon-only sizes** using `size-N` (equal width and height) — square buttons for icon-only actions, which is why `aria-label` appears at every icon-button call site.

**Some sizes restate the icon rule** at a smaller value (`size-3`, `size-3.5`), scaling icons with the button. The `:not([class*='size-'])` guard still lets a caller override.

**`sm:text-2xs`** — the 11px token from `globals.css`, the one whose ordering bug that file's comment records.

---

## Props and the `loading` state

```ts
/** Swaps in a spinner and blocks interaction. Six call sites used to fake
 *  this by rewriting their own label to "Saving…" / "Importing…". */
loading?: boolean;
```

**A consolidation, with the history recorded.** Six call sites hand-rolled a loading state by swapping their own label text. Two of them ([`SettingsPage`](../../pages/SettingsPage.svelte.md), [`SetlistsPage`](../../pages/SetlistsPage.svelte.md)) **still do** — so the codebase currently carries both idioms. [`FeedPage`](../../pages/FeedPage.svelte.md) uses the prop.

```ts
const classes = $derived(cn(buttonVariants({ variant, size }), className));
const isDisabled = $derived(disabled || loading);
```

**`$derived`, not plain consts** — these depend on props, which change. A plain `const` would freeze at initialisation.

**`isDisabled = disabled || loading`** — loading implies disabled. One concept, so a caller can't produce a spinning-but-clickable button.

---

## The `content` snippet

```svelte
{#snippet content()}
  {#if loading}
    <!-- The label keeps its place so the button doesn't resize mid-action. -->
    <span class="absolute inset-0 flex items-center justify-center">
      <Loader2 class="animate-spin" />
    </span>
    <span class="invisible contents">{@render children?.()}</span>
  {:else}
    {@render children?.()}
  {/if}
{/snippet}
```

**A local snippet defined once and rendered from both branches below** — the alternative is duplicating this block inside the `<a>` and the `<button>`.

### The width-preservation trick

**The problem:** replacing the label with a spinner shrinks the button, and a button that changes size mid-click is jarring and can shift surrounding layout.

**The solution — three parts:**

1. The spinner is **`absolute inset-0`**, so it's removed from flow and contributes no width. (This is why the base has `relative`.)
2. The label is still rendered inside **`<span class="invisible contents">`**.
3. **`invisible`** is `visibility: hidden` — the element is not painted but **still occupies its space**. Contrast `hidden` (`display: none`), which would collapse it and defeat the whole purpose.

**`contents`** is the subtle one: `display: contents` makes the span itself generate no box, so its children participate directly in the button's flex layout. Without it, the wrapper span would introduce an extra flex item and the gap/alignment would differ between the loading and idle states — the button would shift by a few pixels exactly when it's trying not to.

**`invisible` + `contents` together** = "reserve exactly the space the label would take, in exactly the layout it would take, but don't draw it."

`Loader2` gets `size-4` from the base rule since it carries no `size-` class.

---

## The anchor / button branch

```svelte
{#if href}
  <!-- An anchor can't be `disabled`, so say so the accessible way and drop
       the target rather than leaving a live link that looks inert. -->
  <a href={isDisabled ? undefined : href} aria-disabled={isDisabled || undefined} class={classes} {...rest}>
    {@render content()}
  </a>
{:else}
  <button class={classes} disabled={isDisabled} {type} {...rest}>
    {@render content()}
  </button>
{/if}
```

**Rendering a real `<a>` when `href` is given** is what makes the dual `href` + `onclick={goto(path, e)}` pattern work across the pages: native anchor behaviour (hover URL, Ctrl/middle-click new tab, screen-reader "link" role) *plus* nav-stack routing. See [`nav-stack.svelte.ts`](../../lib/nav-stack.svelte.ts.md).

**The comment names a real accessibility bug:** HTML has no `disabled` attribute for anchors. Setting `disabled` on an `<a>` does nothing — the link stays fully clickable while looking dimmed.

**Two mitigations, both needed:**

1. **`href={isDisabled ? undefined : href}`** — dropping `href` entirely turns the element into a non-link: not focusable, not activatable, no navigation. This is the *functional* fix.
2. **`aria-disabled={isDisabled || undefined}`** — the *semantic* fix, so assistive tech announces it as disabled. Paired with the base's `aria-disabled:pointer-events-none aria-disabled:opacity-50` for the visual and interaction side.

**`|| undefined` rather than `false`** — Svelte omits an attribute set to `undefined`, whereas `aria-disabled="false"` would be *present and explicitly false*. Semantically different, and the former is what you want.

**`{type}` only on the `<button>`** — anchors have no `type`. Defaulting to `"button"` rather than the HTML default `"submit"` is important: a button inside a `<form>` defaults to submitting it, which is almost never what a UI-library button should do.

---

## Control flow summary

| Construct | Purpose |
|---|---|
| `cva` two axes | 56 combinations from 15 strings |
| `$derived` for `classes` / `isDisabled` | Props change; a plain const would freeze |
| `disabled \|\| loading` | Loading implies disabled — one concept |
| `{#snippet content()}` | Shared by both the `<a>` and `<button>` branches |
| `{#if loading}` | Spinner overlay + invisible label |
| `absolute inset-0` spinner | Contributes no width |
| `invisible contents` | Reserve space *and* layout without painting |
| `{#if href}` | Real anchor when linking, real button otherwise |
| `href={isDisabled ? undefined : href}` | Anchors have no `disabled` — remove the target |
| `aria-disabled={x \|\| undefined}` | Omit the attribute rather than set it to `"false"` |
| `[&_svg:not([class*='size-'])]:size-4` | A default icon size the caller can still override |
| `border-transparent` in the base | Variant switches recolour, never resize |
| `type = "button"` default | Don't accidentally submit a form |

---

## Related
- [`Badge.svelte`](Badge.svelte.md) — the same `cva` pattern, one axis
- [`lib/utils.ts`](../../lib/utils.ts.md) — why `cn` must wrap `cva`
- [`app/globals.css`](../../app/globals.css.md) — `focus-ring`, `shadow-raised`, `duration-fast`, `--text-2xs`
- [`lib/nav-stack.svelte.ts`](../../lib/nav-stack.svelte.ts.md) — the `href` + `goto(e)` contract this enables
