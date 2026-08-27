# `src/main.ts`

**Role:** The application entry point. The single line of JavaScript the browser/WebView runs first.
**Size:** 7 lines. **Depends on:** `./app/globals.css`, `svelte`, `./App.svelte`.

---

## Full source, annotated

```ts
import "./app/globals.css";
```
**What:** Imports the global stylesheet for its side effect only — nothing is bound to a name.
**Why here:** Vite treats a bare CSS import as "include this in the bundle graph." Because `main.ts` is the entry module, this CSS becomes the *first* stylesheet in the output. That ordering matters: `globals.css` defines the Tailwind v4 layers and the CSS custom properties (`--background`, `--foreground`, …) that every component's utility classes resolve against. If it loaded later, there'd be a flash of unstyled content.
**Why not a `<link>` in `index.html`:** Going through the bundler means the CSS is hashed, minified, and tree-shaken alongside the JS, and Tailwind's build step gets to scan the source files for used classes.

```ts
import { mount } from "svelte";
```
**What:** Svelte 5's imperative mounting function.
**Why this and not `new App({...})`:** Svelte 5 removed the class-component constructor API used in Svelte 3/4. `mount(Component, options)` is the replacement. Seeing `mount` here is the fastest single confirmation that this project is on the Svelte 5 runes API, not the legacy one — which tells you `$state`/`$derived`/`$effect` will appear throughout instead of `let` + `$:`.

```ts
import App from "./App.svelte";
```
**What:** The root component — router setup, global chrome, global keybindings.

```ts
const app = mount(App, { target: document.getElementById("root")! });
```
**What:** Instantiates `App` and attaches it to the DOM node with `id="root"`.
**The `!`:** A TypeScript non-null assertion. `getElementById` is typed `HTMLElement | null`, but `index.html` statically contains `<div id="root">`, so the null branch is unreachable. The `!` says "I've checked this by construction" rather than adding a runtime guard that could never fire.
**Why no error handling:** If `#root` were genuinely missing, the app is unrecoverable — a thrown TypeError in the console is a *better* outcome than a silent no-op, because it points straight at the broken HTML.

```ts
export default app;
```
**What:** Re-exports the mounted component instance.
**Why:** Two reasons. (1) It keeps the module from being tree-shaken to nothing under aggressive optimisation. (2) It's the conventional hook for Vite's HMR and for anything that needs to call `unmount(app)`. Nothing in this codebase actually imports it — it's boilerplate from the Tauri/Svelte template, kept because it's harmless and conventional.

---

## Control flow

There is none. No conditionals, no loops, no async. This file is deliberately the dumbest file in the repo: one import for styles, one for the framework, one for the root component, then mount. All decisions — is this desktop or web? which route? is the DB ready? — are pushed downward into `App.svelte` and `lib/db-driver.ts`.

**Why that matters:** A common alternative design would `await` database initialisation here before mounting, so the UI never renders before data is available. This codebase explicitly does *not* do that. It mounts immediately and lets each page `await getDb()` on its own. The consequence you'll see everywhere: pages render a loading/skeleton state first, and `lib/db-driver.ts` has to cache the init *promise* so twenty concurrent `getDb()` calls don't each open a database.

---

## Related

- [`App.svelte`](App.svelte.md) — what actually gets mounted
- [`app/globals.css`](app/globals.css.md) — the stylesheet imported on line 1
- [`config/index.html`](config/index.html.md) — provides the `#root` target
- [`lib/db-driver.ts`](lib/db-driver.ts.md) — the initialisation this file pointedly does *not* wait for
