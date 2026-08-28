# `src/components/ui/Label.svelte`

**Role:** A styled `<label>` for form controls. **Size:** 27 lines.

```svelte
let { class: className = "", for: htmlFor = undefined as string | undefined, children, ...rest } = $props();
```
```svelte
<label for={htmlFor} class={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...rest}>
  {@render children?.()}
</label>
```

## The `for` rename

```ts
for: htmlFor = undefined as string | undefined
```

**A second reserved-word rename**, alongside `class: className`. `for` is a JavaScript keyword and can't be a binding name, so it's destructured to `htmlFor` — the same convention React uses, here needed for the same reason.

**Callers still write `for`**: `<Label for="sl-title">Title</Label>`.

**`as string | undefined`** on the default — an inline cast so the inferred type isn't narrowed to `undefined` by the literal default. The alternative is declaring it in the type block, which this file also does; the cast is belt-and-braces.

## Why `for` matters

`for="x"` associates the label with `id="x"`. Two real consequences:

1. **Clicking the label focuses the control** — a larger hit target, which matters most on touch.
2. **Screen readers announce the label** when the control receives focus. Without it, a `<select>` is announced as an unlabelled combobox.

**Because `for` is optional**, it's easy to omit — and [`SettingsPage`](../../pages/SettingsPage.svelte.md) omits it on four of six labels. That's the accessibility gap noted there. A `Label` that *required* `for` would prevent it, at the cost of being unusable for decorative labels.

## `peer-disabled:`

```
peer-disabled:cursor-not-allowed peer-disabled:opacity-70
```

**Tailwind's peer variant**: style this element based on a *sibling* marked `class="peer"`. So a label following a disabled input dims itself.

**It requires the input to be marked `peer` and to be a preceding sibling** — neither of which is true anywhere in this codebase. `Input.svelte` doesn't add `peer`, and the labels are placed *before* their controls (CSS sibling selectors only look forward). **So these two classes never apply.** Inherited from the shadcn/ui scaffold, like the semicolon-free style in [`utils.ts`](../../lib/utils.ts.md).

## `leading-none`

Line-height 1, removing the extra vertical space a default line-height adds. That's what lets a `space-y-1.5` gap between label and input actually measure 6px rather than 6px plus invisible leading.

## Control flow

None.

---

## Related
- [`Card.svelte`](Card.svelte.md) — the same wrapper pattern
- [`Input.svelte`](Input.svelte.md), [`Select.svelte`](Select.svelte.md) — what labels point at
- [`pages/SettingsPage.svelte`](../../pages/SettingsPage.svelte.md) — where `for` is inconsistently supplied
