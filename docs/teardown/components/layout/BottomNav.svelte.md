# `src/components/layout/BottomNav.svelte`
**Role:** The phone-only floating pill nav. **85 lines.**

## `ITEMS` / `TRAILING`
```ts
const ITEMS    = [{href:"/",…}, {href:"/setlists",…}] as const;
const TRAILING = [{href:"/settings",…}] as const;
```
**Split into two arrays so the Create and Search buttons can sit *between* them.** Order left-to-right is `ITEMS` → Create → Search → `TRAILING` = `/`, `/setlists`, (create), (search), `/settings`.

**This is the order [`sections.ts`](../../lib/sections.ts.md)'s comment warns must match `SECTION_ORDER`** (`["/", "/setlists", "/settings"]`). It does — the two non-route buttons don't participate. **Verify this by hand if you ever reorder either**: nothing enforces it, and a mismatch makes swiping left move you to the tab on the right.

## `isActive`
```ts
const isActive = (href) => href === "/" ? router.location === "/" : router.location.startsWith(href);
```
Identical to [`SiteHeader`](SiteHeader.svelte.md)'s inline version — the `/`-is-a-prefix-of-everything problem. **Duplicated across the two files** rather than shared.

## The pointer-events trick
```svelte
<nav class="pointer-events-none fixed inset-x-0 bottom-0 …">
  <div class="pointer-events-auto … rounded-full …">
```
**The `<nav>` spans the full width but is click-transparent; only the pill itself catches clicks.** Without this, an invisible full-width bar would sit over the bottom of every page and swallow taps on content beside the pill. Two classes, and it's the reason a *floating* pill can work at all.

## Other details
- **`pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`** — lifts the pill clear of the home indicator. Pairs with `App.svelte`'s `pb-navbar` on the scroll container, which reserves the matching space.
- **`md:hidden`** — the header nav takes over above `md`. Exactly complements [`SiteFooter`](SiteFooter.svelte.md)'s `hidden md:block`.
- **`bg-card/85 backdrop-blur-xl`** — translucent with a blur, so content scrolling underneath reads as *behind* the pill.
- **`aria-current={active ? "page" : undefined}`** — the correct ARIA for "this is the current page", and `undefined` omits it rather than writing `"false"`. Same idiom as [`Button`](../ui/Button.svelte.md)'s `aria-disabled`.
- **`aria-label` on every item** — the buttons are icon-only.
- **`size-11` (44px)** — exactly the WCAG minimum touch target, unlike the 36px used elsewhere.
- **The Create button is visually distinct** (`bg-primary`, `active:scale-95`) and is the only one with a press animation — it's the primary action.
- **Search is a `<button>`, the rest are `<a>`** — correct, since search opens an overlay rather than navigating to a URL.
- **The two `{#each}` blocks are unkeyed** and their `<a>` markup is duplicated verbatim between `ITEMS` and `TRAILING`.

**Related:** [`lib/sections.ts`](../../lib/sections.ts.md), [`SectionSwipe.svelte`](SectionSwipe.svelte.md), [`SiteHeader.svelte`](SiteHeader.svelte.md), [`App.svelte`](../../App.svelte.md)
