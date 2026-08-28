# `vite.config.ts`
**Role:** Build and dev-server configuration.

```ts
plugins: [svelte()],
clearScreen: false,
server: { port: 1420, strictPort: true },
envPrefix: ["VITE_", "TAURI_ENV_*"],
build: {
  target: "esnext",
  minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
  sourcemap: !!process.env.TAURI_ENV_DEBUG,
},
resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
```

**`clearScreen: false`** — Vite normally wipes the terminal on start, which would erase the Rust compiler output running alongside it. Small, and specific to Tauri.

**`port: 1420` + `strictPort: true`** — the port [`tauri.conf.json`](../tauri/tauri.conf.json.md)'s `devUrl` hardcodes. **`strictPort` makes a taken port a hard failure** rather than silently moving to 1421, which would leave the Tauri window pointing at nothing. Failing loudly on a two-file coupling.

**`target: "esnext"`** — no downlevelling. Safe because the only consumers are a modern WebView and a modern browser; the output keeps native `async`/`await`, optional chaining, and top-level await ([`db-driver.web.ts`](../lib/db-driver.web.ts.md) relies on modern APIs throughout).

**`minify` / `sourcemap` keyed on `TAURI_ENV_DEBUG`** — Tauri sets it for `tauri dev`. So a debug build is unminified with sourcemaps and a release build is minified without. The double negation (`!process.env.X ? "esbuild" : false` and `!!process.env.X`) is just string-to-boolean coercion.

**`alias: { "@": ./src }`** — the import prefix used in every file (`@/lib/db`). **Must be kept in sync with [`tsconfig.json`](tsconfig.json.md)'s `paths`**: Vite resolves it at build time, TypeScript at check time, and neither reads the other's config. A mismatch means code that type-checks but won't bundle, or vice versa.

**What isn't configured is notable:** no manual `rollupOptions.manualChunks`. All the code-splitting in this app comes from `await import()` in [`db-driver.ts`](../lib/db-driver.ts.md) and [`export.ts`](../lib/export.ts.md), which Vite splits automatically. And no `assetsInclude` for `.wasm` — the `?url` suffix in `db-driver.web.ts` handles that inline.

**Related:** [`tsconfig.json`](tsconfig.json.md), [`tauri/tauri.conf.json`](../tauri/tauri.conf.json.md), [`lib/db-driver.web.ts`](../lib/db-driver.web.ts.md)
