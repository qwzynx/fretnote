# `package.json`
**Role:** Dependencies and the script surface.

## Scripts
```json
"dev": "cross-env GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 tauri dev",
"build": "tauri build",
"vite:dev": "vite",
"vite:dev:web": "vite --port 1421",
"vite:build": "vite build",
"check": "svelte-check --tsconfig ./tsconfig.json",
"lint": "eslint"
```
**`dev` sets two Linux environment variables before Tauri starts:**
- **`WEBKIT_DISABLE_DMABUF_RENDERER=1`** — the same workaround [`lib.rs`](../tauri/lib.rs.md) applies in Rust. Setting it here too means it's already present when the Rust code checks `var_os(...).is_none()`, so the Rust branch is a no-op in dev. Belt and braces across two languages.
- **`GDK_BACKEND=x11`** — forces X11 over Wayland, where WebKitGTK has separate rendering bugs.

**`cross-env`** makes the `VAR=value` prefix work on Windows too.

**`vite:dev` vs `dev`** — the former runs the frontend alone in a browser (the web build, sql.js/OPFS path); the latter runs the full desktop app. **`vite:dev:web` on port 1421** exists so both can run simultaneously without colliding with `strictPort: true`.

**`check` is the real type gate** — `tsc` has `noEmit` and never runs during a build, so `svelte-check` is what catches errors in `.svelte` files.

## Dependencies worth noting
| Package | Why |
|---|---|
| `svelte-spa-router` | Hash routing — required for `file://` |
| `sql.js` + `@types/sql.js` | The browser SQLite backend |
| `@tauri-apps/plugin-sql/-dialog/-fs/-clipboard-manager` | Mirrors the four plugins in `lib.rs` exactly |
| `jspdf` | PDF export, dynamically imported |
| `class-variance-authority`, `clsx`, `tailwind-merge` | The `cn()` + `cva` styling stack |
| `svelte-sonner` | Toasts |
| `@lucide/svelte` | Icons |
| `playwright-core` (dev) | Drives the three `scripts/` checks |

**`"private": true`** — never publishable to npm.

**`"type": "module"`** — every `.js` is an ES module, which is why the config files can use `export default` and the scripts use top-level `await`.

**`"allowScripts": { "esbuild@0.28.1": true }`** — an install-script allowlist (from a hardened npm setup). esbuild needs its postinstall to fetch the native binary.

**Version discipline:** `Cargo.toml`, `tauri.conf.json`, and this file all carry `0.5.0`. **Three files, one number, kept in sync by hand** — and the README badge is a fourth.

**Related:** [`tauri/lib.rs`](../tauri/lib.rs.md), [`vite.config.ts`](vite.config.ts.md), [`tauri/Cargo.toml`](../tauri/Cargo.toml.md)
