# `src/components/ui/Slider.svelte`

**Role:** A range input for font size and scroll speed. **Size:** 32 lines.

```svelte
let { value = $bindable(50), min = 0, max = 100, step = 1, class: className = "",
      "aria-label": ariaLabel = undefined as string | undefined } = $props();
```
```svelte
<input type="range" bind:value {min} {max} {step} aria-label={ariaLabel}
       class={cn("focus-ring w-full cursor-pointer rounded-full accent-primary", className)} />
```

## The quoted prop name

```ts
"aria-label": ariaLabel = undefined as string | undefined
```

**A third reserved-name rename**, after `class: className` and `for: htmlFor`. Here the problem is the hyphen: `aria-label` isn't a valid identifier, so it must be quoted in the destructuring pattern and bound to a legal name.

**Declared explicitly rather than forwarded via `...rest`** — and note this component has **no `...rest` at all**. That's a deliberate narrowing: a range input's meaningful surface is exactly `value`, `min`, `max`, `step`, and a label. Anything else a caller might pass is silently dropped.

The cost is real: `<Slider id="x">` or `<Slider disabled>` do nothing. `aria-label` is spelled out precisely *because* there's no `rest` to carry it, and it's needed — [`SettingsPage`](../../pages/SettingsPage.svelte.md)'s `<Label>`s have no `for`, so the slider must name itself.

## `$bindable(50)`

Same mechanism as [`Input.svelte`](Input.svelte.md). The default of `50` is the midpoint of the default `0`–`100` range — a sensible neutral for a component used with no props, though both call sites override every value.

**`bind:value` on `<input type="range">` gives a number**, not a string — Svelte coerces for range and number inputs. That's why `SettingsPage` can write `{s.defaultFontSize}px` without parsing.

## `accent-primary`

**One class doing all the theming.** The CSS `accent-color` property tints a native form control's interactive parts — for a range input, the track fill and the thumb — using the browser's own rendering.

The alternative is the `::-webkit-slider-thumb` / `::-moz-range-thumb` pseudo-element route: a dozen rules, two engines, and a from-scratch reimplementation of the thumb. `accent-color` gets 90% of the result in one declaration, and keeps native keyboard behaviour (arrows, Home/End, Page Up/Down) and platform-appropriate rendering for free.

**The limit:** you can't change the shape or size this way. [`globals.css`](../../app/globals.css.md) covers that gap separately, scaling the thumb 1.35× under `@media (pointer: coarse)` — so touch sizing is handled globally rather than here.

## `focus-ring`

**Uses the shared utility**, unlike `Input.svelte` which respells the ring inline. This is the intended usage — *"every control can opt in with a single class"* — and the inconsistency between the two primitives is worth noting.

## `rounded-full`

Applies to the input element itself, mostly affecting the focus outline's shape (modern browsers follow `border-radius` when drawing `outline`). The track's own rounding is the browser's.

## `cursor-pointer`

Overrides the default arrow. Small, but it signals draggability before the user tries.

## Control flow

None. No conditionals, no loops, no `rest`. The most constrained component in `ui/` — which is the point: it wraps a native control that already does the hard part.

---

## Related
- [`Input.svelte`](Input.svelte.md) — the other `$bindable` primitive, with `...rest`
- [`app/globals.css`](../../app/globals.css.md) — `focus-ring`, and the `pointer: coarse` thumb scaling
- [`pages/SettingsPage.svelte`](../../pages/SettingsPage.svelte.md) — both call sites, with `tabular-nums` readouts
