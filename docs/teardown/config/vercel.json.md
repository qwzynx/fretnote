# `vercel.json`
**Role:** Deploy config for the browser build.

```json
{ "buildCommand": "npm run vite:build", "outputDirectory": "dist" }
```

**Two lines, and their significance is architectural.** They are the proof that the "one bundle, two platforms" strategy is real rather than theoretical:

- **`vite:build`, not `build`** — [`package.json`](package.json.md)'s `build` is `tauri build`, which compiles Rust. Vercel has no Rust toolchain and no reason to; this runs the frontend build alone.
- **`dist` is the same directory** [`tauri.conf.json`](../tauri/tauri.conf.json.md) sets as `frontendDist`. **One artifact, embedded in the desktop binary and deployed to the web.**

That works only because of the runtime platform detection in [`db-driver.ts`](../lib/db-driver.ts.md) and [`export.ts`](../lib/export.ts.md) — `"__TAURI_INTERNALS__" in window` decides at load time which half of the bundle to fetch. The web deploy gets sql.js + OPFS; the desktop build gets the Tauri plugins. Neither downloads the other's chunk.

**No `rewrites` and no SPA fallback** — because the app uses **hash routing** (`#/notes/abc`). The server only ever sees `/`, so there are no deep-link 404s to rewrite. The routing choice that Tauri's `file://` origin forced also removes the need for server config on the web.

**Related:** [`lib/db-driver.ts`](../lib/db-driver.ts.md), [`tauri/tauri.conf.json`](../tauri/tauri.conf.json.md), [`App.svelte`](../App.svelte.md)
