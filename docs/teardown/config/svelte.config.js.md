# `svelte.config.js`
**Role:** Svelte compiler configuration. Three lines.

```js
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
export default { preprocess: vitePreprocess() };
```

**`vitePreprocess()` is what makes `<script lang="ts">` work.** Svelte's compiler doesn't understand TypeScript; the preprocessor runs each block through Vite's transform pipeline (esbuild) first, stripping types before Svelte sees it. It does the same for `<style lang="postcss">` blocks.

**No `compilerOptions`, no `runes: true`** — Svelte 5 detects runes mode automatically per file: any file using `$state`/`$props`/`$derived` is compiled in runes mode. Since every component here uses them, the whole app is runes mode without configuration.

**No adapter, no `kit` key** — this is **not SvelteKit**. Plain Svelte + Vite + `svelte-spa-router`. That's the right call for a Tauri app served from `file://`, where SvelteKit's server-side machinery has nothing to run on.

**A `.js` file, not `.ts`** — config files loaded by the toolchain before the TS pipeline exists.

**Related:** [`vite.config.ts`](vite.config.ts.md), [`tsconfig.json`](tsconfig.json.md)
