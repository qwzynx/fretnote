# `src-tauri/src/lib.rs`
**Role:** The entire Rust backend — 21 lines. **Registers four plugins and applies one Linux workaround.**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
```
**`cfg_attr` applies the attribute conditionally.** On mobile targets (Android), `#[tauri::mobile_entry_point]` marks this as the JNI entry the Android shell calls. On desktop the attribute vanishes and `run()` is called from [`main.rs`](main.rs.md). **One function, two entry mechanisms** — which is why the logic lives in a `lib` crate rather than in `main.rs`.

## The WebKitGTK workaround
```rust
// On Linux, WebKitGTK's DMABUF renderer produces a blank/black WebView on
// some GPU/driver combos. The usual workaround is disabling compositing
// entirely, but that forces every frame (including scrolling) to be painted
// on the CPU — causing scroll lag and high CPU/fan usage. Disabling only the
// DMABUF renderer keeps GPU-accelerated compositing (smooth scrolling) while
// still avoiding the blank-window bug. Must be set before the WebView starts.
#[cfg(target_os = "linux")]
if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
}
```
**The best comment in the repo for showing how a fix was *chosen*.** The obvious workaround (`WEBKIT_DISABLE_COMPOSITING_MODE=1`) trades a blank window for CPU-painted scrolling — a fix that makes the app feel worse everywhere to solve a problem on some machines. Disabling only the DMABUF path keeps GPU compositing.

**`#[cfg(target_os = "linux")]`** — compiled out entirely elsewhere, not a runtime branch.

**`var_os(...).is_none()`** — only set it if the user hasn't. So `WEBKIT_DISABLE_DMABUF_RENDERER=0 fretnote` lets someone opt out. `var_os` avoids the UTF-8 validation `var` performs, which is the right call for a presence check.

**"Must be set before the WebView starts"** — hence its position above `Builder::default()`. `set_var` is `unsafe` in newer Rust editions; on 2021 it isn't.

Note [`package.json`](../config/package.json.md)'s `dev` script *also* exports this variable, so it's set two ways.

## The builder
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::new().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```
**Four plugins, and each maps to exactly one thing the frontend does:**

| Plugin | Used by |
|---|---|
| `sql` | [`db-driver.ts`](../lib/db-driver.ts.md) — `Database.load("sqlite:fretnote.db")` |
| `clipboard-manager` | [`export.ts`](../lib/export.ts.md) — `copyTextToClipboard` tier 1 |
| `dialog` | `export.ts` + [`backup.ts`](../lib/backup.ts.md) — native save/open |
| `fs` | Writing the PDF and `.fretnote` files |

**No `#[tauri::command]` anywhere.** There is no custom IPC in this app — every capability comes from an off-the-shelf plugin, and all logic is TypeScript. That is the single most important architectural fact about this codebase, and it's visible in 21 lines.

**`.expect(...)`** — a startup failure panics with a message rather than being handled. Correct: there is no recovery from "the window wouldn't open."

**Related:** [`main.rs`](main.rs.md), [`Cargo.toml`](Cargo.toml.md), [`tauri.conf.json`](tauri.conf.json.md), [`lib/db-driver.ts`](../lib/db-driver.ts.md)
