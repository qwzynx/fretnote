# `src/components/layout/SiteHeader.svelte`
**Role:** The sticky top bar — logo, desktop nav, search trigger, settings, new note. **79 lines.**

## `NAV`
```ts
const NAV = [
  { href: "/", label: "Notes", icon: Home },
  { href: "/create", label: "Create", icon: PlusCircle },
  { href: "/setlists", label: "Setlists", icon: ListMusic },
];
```
Data-driven nav. **Icons stored as component references**, not elements — the same technique as [`EmptyState`](../ui/EmptyState.svelte.md)'s `icon` prop.

**Note this list differs from [`sections.ts`](../../lib/sections.ts.md)'s `SECTION_ORDER`** (`/`, `/setlists`, `/settings`): this one includes `/create` and excludes `/settings` (which gets its own icon button). **Three different navigation lists** exist in the codebase — this one, `SECTION_ORDER`, and `BottomNav`'s — and only the last two are required to agree.

## Active-state detection
```svelte
{@const active = item.href === "/"
  ? router.location === "/"
  : router.location.startsWith(item.href)}
```
**The ternary exists because `/` is a prefix of everything.** `"/setlists".startsWith("/")` is `true`, so a naive `startsWith` would mark Notes active on every page. Home needs exact equality; the others need prefix matching so `/setlists/abc` still highlights Setlists.

**`router.location`** is `svelte-spa-router`'s reactive current path — the one place the app reads router state directly rather than going through [`nav-stack`](../../lib/nav-stack.svelte.ts.md).

## `<svelte:component this={item.icon} />`
Renders a component held in a variable. **Legacy syntax in Svelte 5** — the modern form is to capitalise the binding and write `<Icon />`, which is what `EmptyState` does. Both work; this is the older idiom.

## Template details
- **`sticky top-0 z-40`** — pinned. `z-40` sits below the `z-50` used by dialogs and popovers, so overlays cover it.
- **`pt-[env(safe-area-inset-top,0px)]`** — pads for the notch. The `--spacing-safe-t` token in [`globals.css`](../../app/globals.css.md) exists for this but isn't used here.
- **`h-12 sm:h-14`** — shorter on phones, where vertical space is scarce.
- **`Fret<span class="text-primary">note</span>`** — the wordmark, amber second half.
- **`ml-auto`** on the action group pushes it right.
- **`hidden md:flex` on both the nav and the action group** — everything except the logo disappears below `md`, because [`BottomNav`](BottomNav.svelte.md) takes over. The header becomes a bare title bar on phones.
- **`<kbd>⌘K</kbd>`** — a discoverability hint for the shortcut bound in [`App.svelte`](../../App.svelte.md). Uses `text-3xs`, the 10px token annotated *"kbd"* in `globals.css`. Shows the Mac symbol on every platform.
- **Search uses `onclick={() => openSearch()}`** (not `toggleSearch`) — a header click should always open, never close.
- **`{#each NAV as item}` is unkeyed** — fine for a static list.

**Related:** [`App.svelte`](../../App.svelte.md), [`BottomNav.svelte`](BottomNav.svelte.md), [`lib/nav-stack.svelte.ts`](../../lib/nav-stack.svelte.ts.md), [`lib/sections.ts`](../../lib/sections.ts.md)
