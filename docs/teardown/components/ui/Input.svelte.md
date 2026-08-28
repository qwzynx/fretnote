# `src/components/ui/Input.svelte`

**Role:** A styled text input with two-way binding. **Size:** 26 lines.

```svelte
let { class: className = "", type = "text", value = $bindable(""), ...rest } = $props();
```
```svelte
<input {type} bind:value class={cn("flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:text-sm dark:bg-input/30", className)} {...rest} />
```

## `$bindable` — the key line

```ts
value = $bindable("")
```

**This is what makes `<Input bind:value={newTitle} />` work.** By default Svelte 5 props are one-way: a child can read them but not write back. `$bindable(default)` marks a prop as two-way, so `bind:value` at the call site keeps parent and child in sync.

Without it, `bind:value` on this component is a compile error, and every consumer — `SetlistsPage`'s create form, `SetlistPage`'s title editor, `TagInput` — would need an `oninput` callback instead.

**`$bindable("")` supplies the default** for a caller who passes no `value` at all, making the component usable uncontrolled.

**`bind:value` on the inner `<input>`** then chains the binding through: DOM → component prop → parent variable.

**`value?: string | number`** in the type — `number` because `<input type="number">` binds a number. This component is used with `type="text"` throughout, but the type permits both.

## `type` as a separate prop

```ts
type = "text"
```

**Destructured out of `rest` and re-applied explicitly** as `{type}`. It could have ridden along in `...rest` — the practical effect is identical. Pulling it out gives it a documented default and makes it visible in the signature.

**Note `min`/`max`/`step` are *not* destructured**, so they'd flow through `rest` and work fine. That makes [`SettingsPage`](../../pages/SettingsPage.svelte.md)'s decision to hand-roll a raw `<input type="number">` — duplicating this entire class string — look unnecessary. The likely real reason is the spinner-hiding classes, which would have to be passed as `class` anyway.

## The comment that matters

```
// `text-base` on phones — anything smaller makes iOS Safari zoom on focus.
```

**A real mobile-browser behaviour**, and one of the most commonly-hit web quirks. iOS Safari auto-zooms the viewport when focusing an input whose font-size is below 16px, and it does **not** zoom back out. The user is left in a magnified layout.

`text-base` is exactly 16px. **`sm:text-sm`** drops to 14px only above the phone breakpoint, where the behaviour doesn't apply. The same reasoning drives **`h-10` → `sm:h-8`**: a 40px touch target on phones, 32px on desktop.

## The rest of the class string

**`focus-visible:` not `focus:`** — the same accessibility distinction as `globals.css`'s `focus-ring` utility: a ring for keyboard users, none for mouse clicks. Note this component **doesn't use** that shared utility, instead respelling the ring inline (`focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring`). Given the utility exists precisely so *"every control can opt in with a single class instead of respelling the ring"*, this is a missed consolidation — and it produces a slightly different treatment (ring + border change, vs the utility's outline).

**`focus-visible:outline-none`** removes the browser default before drawing the custom ring. Safe only because a replacement is provided.

**`disabled:cursor-not-allowed disabled:opacity-50`** — the disabled state.

**`bg-transparent … dark:bg-input/30`** — vestigial. The app ships dark-only with `:root` carrying the dark palette and no `.dark` class on the tree, so per [`globals.css`](../../app/globals.css.md)'s `@custom-variant dark (&:is(.dark *))` this rule never matches. The input is transparent, not tinted.

**`border-input`** — a dedicated token (`oklch(1 0 0 / 13%)`), slightly stronger than `--border`, so form fields read as interactive.

**`w-full`** — inputs always fill their container; width is the caller's business via a wrapper or `className`.

## Control flow

None. No conditionals, no loops. The component is a styled, bindable `<input>`.

---

## Related
- [`Label.svelte`](Label.svelte.md) — pairs with this via `for`/`id`
- [`Slider.svelte`](Slider.svelte.md) — the other `$bindable` primitive
- [`pages/SettingsPage.svelte`](../../pages/SettingsPage.svelte.md) — hand-rolls a number input duplicating this styling
- [`app/globals.css`](../../app/globals.css.md) — the `focus-ring` utility this respells
