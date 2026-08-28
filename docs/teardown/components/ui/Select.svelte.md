# `src/components/ui/Select.svelte`

**Role:** A styled native `<select>` with a custom chevron. **Size:** 59 lines.

## The design choice: a native `<select>`

Every other dropdown-ish thing in this codebase is hand-built ([`Popover`](Popover.svelte.md), `NotePage`'s export menu). This one wraps the **browser's own control**, and that's the right call for a form field: on Android and iOS a native `<select>` opens the platform picker — a full-screen wheel or list, not a tiny hover menu. Reimplementing that well is a large amount of work; using it is free.

What you give up is styling the *options*. Which is why the component styles only the closed state and lets the browser own the open one.

## Props

```ts
value = $bindable(""), items = [] as SelectItem[], placeholder = "",
size = "default" as "default" | "sm", class: className = "",
onValueChange = undefined as ((v: string) => void) | undefined, ...rest
```

**`items: { value, label }[]`** — a data-driven option list rather than slotted `<option>` children. That's what lets [`SettingsPage`](../../pages/SettingsPage.svelte.md) write `TUNINGS.map(t => ({ value: t.id, label: t.label }))` and keep the dropdown derived from the source data.

**Both `$bindable` *and* `onValueChange`** — two ways to observe the same change. Redundant in principle; useful in practice when a caller needs a side effect (refetch, recompute) rather than just a stored value. Both fire.

## `handleChange`

```ts
function handleChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  value = v;
  onValueChange?.(v);
}
```

**A manual handler rather than `bind:value` on the `<select>`.** Note the markup uses `{value}` (one-way) plus `onchange`, not `bind:value`.

**Why:** `bind:value` would keep the binding in sync but gives no hook for `onValueChange`. Writing the assignment by hand lets both mechanisms fire from one place, in a defined order — binding first, callback second, so a callback that reads `value` sees the new one.

**`const v` extracted once** rather than reading `e.target.value` twice; also gives the cast a single site.

## The wrapper comment — a real bug

> *"`className` belongs on the wrapper, not the `<select>`. Sizing and visibility classes are what call sites pass, and putting them on the inner element meant `class="sm:hidden"` **hid the control but left its chevron floating on the page**."*

**A precise, memorable bug.** The chevron is a separate `<svg>` positioned `absolute` against the wrapper. If `className` landed on the `<select>`, then `class="sm:hidden"` hid the select and left the chevron — an arrow floating over nothing.

**The fix is a rule about where caller classes go**: on the outermost element, because that's what callers are addressing when they pass layout, sizing, or visibility classes. Worth generalising — any component with decorative siblings has this hazard.

Note the consequence: `size` is a *prop* rather than something a caller expresses via `className`, precisely because height must land on the inner `<select>`.

## The markup

```svelte
<div class={cn("relative inline-flex items-center", className)}>
```

**`relative`** anchors the absolutely-positioned chevron. **`inline-flex`** so the wrapper shrinks to content by default while callers can pass `w-full`.

```svelte
<select {value} onchange={handleChange} class={cn(
  "focus-ring w-full appearance-none rounded-lg border border-input bg-input/30 pr-8 pl-3 text-base transition-colors hover:bg-input/50 disabled:cursor-not-allowed disabled:opacity-50 sm:pr-7 sm:pl-2.5 sm:text-sm",
  size === "sm" ? "h-9 sm:h-7 sm:text-2xs" : "h-10 sm:h-8"
)} {...rest}>
```

**`appearance-none`** — strips the browser's native chevron and background so the custom one can take over. **This is what makes the custom chevron necessary**: without `appearance-none` there'd be two arrows; with it and no replacement, none.

**`pr-8` (32px right padding)** — reserves the space the chevron sits in, so a long option label doesn't run underneath it. The pairing of `pr-8` with `right-2 size-4` is a hand-calculated fit.

**`text-base` … `sm:text-sm`** — the same iOS-zoom guard documented in [`Input.svelte`](Input.svelte.md). Applies to `<select>` too.

**`h-10 sm:h-8`** — touch-first heights matching `Input` and `Button`. The `size="sm"` variant drops to `h-9 sm:h-7`.

**`focus-ring`** — the shared utility, used correctly here (as in `Slider`, unlike `Input`).

**`{...rest}` on the `<select>`, not the wrapper** — so `disabled`, `id`, `name`, `aria-*` reach the actual form control, where they mean something. The split is deliberate: `className` outward, everything else inward.

## The options

```svelte
{#if placeholder}
  <option value="" disabled>{placeholder}</option>
{/if}
{#each items as item (item.value)}
  <option value={item.value}>{item.label}</option>
{/each}
```

**`<option value="" disabled>`** — a placeholder that displays when `value` is `""` but **cannot be re-selected** once the user picks something real. The standard pattern for "choose one" prompts. Note it isn't `hidden`, so it remains visible in the open list on some platforms.

**Keyed `{#each}`** by `item.value`, which the `SelectItem` shape guarantees is unique. Not strictly needed for static option lists, but consistent with the codebase.

## The chevron

```svelte
<ChevronDown class="pointer-events-none absolute right-2 size-4 text-muted-foreground sm:right-1.5" />
```

**`pointer-events-none` is essential.** The chevron sits *on top of* the select. Without this, clicking the arrow — the most natural place to click — would hit the SVG and do nothing. Clicks now pass through to the control beneath.

**No vertical positioning class** — the wrapper's `items-center` centres it.

## Control flow summary

| Construct | Purpose |
|---|---|
| `{value}` + `onchange`, not `bind:value` | One place to fire both the binding and `onValueChange` |
| `className` on the **wrapper** | Otherwise `sm:hidden` orphans the chevron |
| `{...rest}` on the **`<select>`** | `disabled`/`id`/`aria-*` belong on the control |
| `size === "sm" ? … : …` | Height must land inside, so it's a prop not a class |
| `appearance-none` + custom chevron | Strip the native arrow, supply a themed one |
| `pointer-events-none` on the chevron | Clicks must reach the select underneath |
| `pr-8` | Reserve space so labels don't run under the arrow |
| `{#if placeholder}` + `disabled` option | Shows initially, can't be re-chosen |

---

## Related
- [`Input.svelte`](Input.svelte.md) — same touch-first sizing and the iOS-zoom rule
- [`Label.svelte`](Label.svelte.md) — and the missing `for` associations at the call sites
- [`pages/SettingsPage.svelte`](../../pages/SettingsPage.svelte.md) — all three consumers
