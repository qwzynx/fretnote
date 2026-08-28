# `src/components/ui/EmptyState.svelte`

**Role:** One treatment for every "there's nothing here" and "something went wrong" moment. **Size:** 60 lines.

## The comment is the justification

> *"One treatment for every 'there's nothing here' moment. These were **seven hand-rolled boxes across three incompatible designs**, with padding ranging from `py-4` to `py-20` and **only some of them offering a way forward**."*

Two distinct problems named. The visual one (seven inconsistent boxes) is the obvious half. The second — *"only some of them offering a way forward"* — is the important one: an empty state without an action is a dead end, and consistency here means consistently offering the way out.

**The consolidation is incomplete.** [`SetlistsPage`](../../pages/SetlistsPage.svelte.md) and [`SetlistPage`](../../pages/SetlistPage.svelte.md) still hand-roll their empty states; only [`FeedPage`](../../pages/FeedPage.svelte.md) uses this component, and only for its *error* state. Three of the seven boxes remain.

## Props

```ts
icon?: Component;          // a lucide component, e.g. Music2
title: string;             // the only required prop
description?: string;
tone?: "empty" | "error";  // error swaps the border to the destructive hue
size?: "default" | "compact";
action?: Snippet;          // buttons for the way out
```

**`icon?: Component`** — the *component itself*, not a rendered element. Svelte 5's `Component` type. Passing `icon={DatabaseZap}` (a reference) rather than `<DatabaseZap />` lets this component control the icon's classes.

```ts
const Icon = $derived(icon);
```

**A capitalised alias, and it's mandatory.** Svelte's template syntax treats lowercase names as HTML tags and capitalised names as components — `<icon />` would render a literal `<icon>` element. Renaming to `Icon` is what makes `<Icon />` a component instantiation.

**`$derived`, not `const Icon = icon`** — `icon` is a prop and can change; a plain const would freeze the first value.

**`action?: Snippet`** — a snippet rather than a button prop, so the caller decides how many buttons and what they do:

```svelte
{#snippet action()}
  <Button variant="outline" onclick={reload}>Try again</Button>
{/snippet}
```

**`title` is the only required prop.** A minimal call is `<EmptyState title="Nothing here" />`.

## The `tone` axis

```svelte
role={tone === "error" ? "alert" : undefined}
```

**The most consequential line.** `role="alert"` is an ARIA live region — assistive technology announces its content **immediately and interruptively** when it appears. Correct for an error a user must know about.

**And correctly *omitted* for the empty tone** (`undefined`, so the attribute isn't emitted). An empty list is not an alert, and announcing "No setlists yet" over whatever the user was doing would be noise. **Two states, two different accessibility contracts**, decided by one ternary.

`tone` then drives two more ternaries — the border (`border-destructive/40` vs `border-border`) and the icon colour (`text-destructive/70` vs `text-muted-foreground/40`). Three uses of one prop, each in a different concern.

## The `size` axis

```svelte
size === "compact" ? "gap-2 py-10" : "gap-3 py-14 sm:py-20"
```

**Directly addresses the comment's `py-4`-to-`py-20` spread** — now two values instead of seven. Note only the default size is responsive (`py-14 sm:py-20`); compact stays fixed, appropriate for an inline context where the surrounding layout already sets the rhythm.

## The markup

```svelte
<div class={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center", …)}>
```

**`border-dashed`** — the visual convention for a placeholder region, distinguishing it from a real card. The hand-rolled versions in the setlist pages use the same dashed border, which is why they look similar despite not sharing code.

**Three optional blocks**, each guarded:

```svelte
{#if Icon}  <Icon class={cn("size-8", …)} />  {/if}
<p class="font-medium">{title}</p>
{#if description}  <p class="max-w-sm text-sm text-balance text-muted-foreground">{description}</p>  {/if}
{#if action}  <div class="mt-1 flex flex-wrap justify-center gap-2">{@render action()}</div>  {/if}
```

**Only `title` is unconditional**, matching its required type.

**`max-w-sm` on the description** — caps the measure at ~24rem regardless of container width. Long lines are hard to read; this is basic typographic hygiene that a `w-full` centred paragraph would miss.

**`text-balance`** — the browser evens out line lengths so the last line isn't a single orphaned word. The same property `globals.css` applies to headings, here applied to body copy where the text is short enough for it to be cheap.

**`flex-wrap` on the action row** — two buttons that don't fit stack rather than overflow.

**`{@render action()}` without `?.`** — safe, because it's inside `{#if action}`.

## Control flow summary

| Construct | Purpose |
|---|---|
| `const Icon = $derived(icon)` | Capitalisation is what makes `<Icon />` a component |
| `role={tone === "error" ? "alert" : undefined}` | Errors are announced; empty states are not |
| `tone === "error" ? … : …` ×3 | One prop driving role, border, and icon colour |
| `size === "compact" ? … : …` | Two padding scales replacing seven |
| `{#if Icon}` / `{#if description}` / `{#if action}` | Only `title` is required |
| `max-w-sm` + `text-balance` | Readable measure, no orphaned last word |

---

## Related
- [`pages/FeedPage.svelte`](../../pages/FeedPage.svelte.md) — the only consumer, for its error state
- [`pages/SetlistsPage.svelte`](../../pages/SetlistsPage.svelte.md), [`pages/SetlistPage.svelte`](../../pages/SetlistPage.svelte.md) — still hand-rolled
- [`Button.svelte`](Button.svelte.md) — what goes in the `action` snippet
