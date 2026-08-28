# `postcss.config.mjs`
**Role:** PostCSS configuration — one plugin.

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

**One plugin, and that's the Tailwind v4 story.** In v3 this file typically carried `tailwindcss` *and* `autoprefixer`, plus a `tailwind.config.js` beside it. In v4:

- **Autoprefixer is gone** — Tailwind v4 uses Lightning CSS internally, which handles prefixing and modern-syntax lowering itself.
- **There is no `tailwind.config.js`** — configuration moved into CSS via `@theme`, which is why [`globals.css`](../app/globals.css.md) is 336 lines and does the job a JS config used to.

**`@tailwindcss/postcss`** is the v4 plugin package (v3's was `tailwindcss` directly). It scans source files for class names, generates the utilities from the `@theme` blocks, and emits the stylesheet.

**`.mjs`** forces ES module semantics regardless of `package.json`'s `"type"` — a convention for tool config files.

**Empty options `{}`** — the plugin finds `globals.css` through the import graph starting at [`main.ts`](../main.ts.md), so nothing needs configuring.

**Related:** [`app/globals.css`](../app/globals.css.md) — the actual Tailwind configuration
