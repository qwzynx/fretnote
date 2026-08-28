# `src/components/layout/SiteFooter.svelte`
**Role:** Desktop-only footer with a tagline and two links. **25 lines.**

```svelte
<!-- Phones get the bottom pill nav instead; this footer would only steal room. -->
<footer class="hidden border-t border-border/80 bg-background md:block">
```

**`hidden md:block`** — the entire component is invisible below `md`. The comment explains: [`BottomNav`](BottomNav.svelte.md) already occupies the bottom of the screen on phones, and a second footer above it would waste vertical space on a device that has none to spare.

Note it's rendered *inside* [`App.svelte`](../../App.svelte.md)'s scroll container (unlike the header and bottom nav), so it scrolls away with the content rather than being pinned.

**`border-border/80`** — the border token at 80% opacity, slightly softer than a full-strength divider. The same value is used on `SiteHeader`'s bottom border, so the two frame the content symmetrically.

**Two links, both using the `href` + `goto(path, e)` pair** — real anchors for native behaviour, `goto` for the [`nav-stack`](../../lib/nav-stack.svelte.ts.md) invariant. See [`Button.svelte`](../ui/Button.svelte.md) for why both are needed.

**`<nav>`** around the links gives them a landmark role for assistive tech.

**Only two links (Notes, Create)** while the header and bottom nav both offer four destinations — Setlists and Settings are absent. An inconsistency rather than a decision.

No script logic, no conditionals, no loops.

**Related:** [`App.svelte`](../../App.svelte.md), [`BottomNav.svelte`](BottomNav.svelte.md), [`SiteHeader.svelte`](SiteHeader.svelte.md)
