# `src-tauri/tauri.conf.json`
**Role:** Tauri's app configuration — window, build hooks, bundling, plugin setup.

## `build`
```json
"frontendDist": "../dist",
"devUrl": "http://localhost:1420",
"beforeDevCommand": "npm run vite:dev",
"beforeBuildCommand": "npm run vite:build"
```
**`devUrl` must match [`vite.config.ts`](../config/vite.config.ts.md)'s `port: 1420`**, which is why that file sets `strictPort: true` — if the port were taken and Vite silently moved, the WebView would load nothing. Two files, one number, made safe by failing loudly.

**`before*Command` means `npm run tauri dev` builds the frontend itself** — you never run Vite separately.

**`frontendDist: "../dist"`** is what the release build embeds. Note the same `dist` is what [`vercel.json`](../config/vercel.json.md) deploys — one output, two delivery paths, which is the "one bundle, runtime detection" strategy [`db-driver.ts`](../lib/db-driver.ts.md) describes.

## `app.windows`
```json
{ "title": "Fretnote", "width": 1280, "height": 860, "minWidth": 800, "minHeight": 600 }
```
**`minWidth: 800`** sits above Tailwind's `sm` (640) and below `lg` (1024) — so a desktop window can be dragged into the "compact" range where [`CreateNoteForm`](../components/create/CreateNoteForm.svelte.md) collapses to one pane, but never into the phone layout. The responsive code below `sm` is Android-only in practice.

## `security.csp: null`
**Content Security Policy disabled.** Worth understanding rather than glossing over: a CSP would restrict what the WebView may load or execute. It's `null` here — probably because [`db-driver.web.ts`](../lib/db-driver.web.ts.md) instantiates WebAssembly (needing `wasm-unsafe-eval`) and [`lyrics.ts`](../lib/lyrics.ts.md) fetches two external APIs (needing `connect-src`).

**The risk is bounded but real:** the app renders user-authored text, and while Svelte escapes interpolations by default, a CSP is the defence-in-depth layer that isn't there. Tightening it is the single highest-value hardening change available.

## `bundle`
**`"targets": "all"`** — every installer format for the host platform (deb/rpm/AppImage on Linux, msi/nsis on Windows, dmg/app on macOS). Driven by [`.github/workflows/release.yml`](../config/release.yml.md).

**`identifier: "com.fretnote.app"`** — the reverse-DNS bundle id. **This is what determines the app-data directory** where `Database.load("sqlite:fretnote.db")` resolves `fretnote.db`. **Changing it orphans every existing user's library.**

## `plugins.sql.preloadConnections`
```json
"sql": { "preloadConnections": ["sqlite:fretnote.db"] }
```
**Opens the connection at app start** rather than on first `Database.load(...)`. Shaves the connection setup off the first query — which matters because [`getDb()`](../lib/db-driver.ts.md) runs the whole schema/migration sequence before the feed can render.

The string matches `db-driver.ts` exactly; a mismatch would open a second, unused database file.

**Related:** [`lib.rs`](lib.rs.md), [`config/vite.config.ts`](../config/vite.config.ts.md), [`lib/db-driver.ts`](../lib/db-driver.ts.md)
