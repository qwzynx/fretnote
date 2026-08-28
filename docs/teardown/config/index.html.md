# `index.html`
**Role:** The HTML shell Vite serves and builds from.

```html
<html lang="en" class="dark">
```
**`class="dark"`** is what makes [`globals.css`](../app/globals.css.md)'s `@custom-variant dark (&:is(.dark *))` match — every `dark:` utility in the codebase depends on this one attribute. (Though since `:root` already carries the dark palette, the variant is mostly redundant.)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```
**`viewport-fit=cover` is required for `env(safe-area-inset-*)` to return non-zero.** Without it the page is letterboxed inside the safe area and every `env()` reads `0px` — so [`BottomNav`](../components/layout/BottomNav.svelte.md)'s home-indicator clearance and `globals.css`'s `--spacing-navbar` would silently do nothing. One attribute enabling a whole family of layout rules.

**`theme-color="#211f1d"`** tints the Android status bar to match the app ground. It's a hex approximation of `--background: oklch(0.155 0.006 60)` — a fourth place that colour is written, and unlinked to the token.

## The preloads
> *"Fonts are self-hosted (see globals.css). Preloading the two latin faces lets them start downloading alongside the CSS rather than after it, so there is no visible swap on a cold start."*

**Fonts are discovered late** — the browser must download the CSS, parse it, find the `@font-face`, and match a `unicode-range` before requesting the file. `rel="preload"` starts both fetches immediately, in parallel with the CSS.

**Only the two `latin` subsets are preloaded**, not `latin-ext` — the common case, avoiding a wasted download for the extended set most users never trigger. That's the whole point of the subsetting in `globals.css`.

**`crossorigin` is mandatory on font preloads**, even same-origin. Fonts are always fetched in CORS mode; without the attribute the browser fetches the file *twice* — once for the preload and once for the real request — and warns in the console. The single most common preload mistake.

## The inline critical style
```html
<style>
  /* Paint the app ground before the stylesheet lands, so a cold start
     never flashes white. Must track --background in globals.css. */
  html, body { background: oklch(0.155 0.006 60); margin: 0; }
</style>
```
**A flash-of-white fix.** Until `globals.css` loads, the page is the browser default — white. On a dark app that's a jarring strobe, worst on a cold Tauri launch.

**Inline, so it applies with the first byte of HTML.** A `<link>` would arrive too late by definition.

**"Must track `--background`"** — the value is duplicated because a CSS variable defined in the external stylesheet isn't available yet. An unavoidable duplication, and honestly labelled.

**`margin: 0`** kills the default body margin before the Tailwind reset arrives.

**`<div id="root">`** is the target [`main.ts`](../main.ts.md) asserts non-null with `!`.

**Related:** [`main.ts`](../main.ts.md), [`app/globals.css`](../app/globals.css.md), [`vite.config.ts`](vite.config.ts.md)
