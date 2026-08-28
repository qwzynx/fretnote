# `src-tauri/src/main.rs`
**Role:** The desktop binary entry point. **6 lines.**

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    fretnote_lib::run()
}
```

## The crate-level attribute
**`#![...]` (with `!`) applies to the whole crate**, not the next item — which is why it must be the first thing in the file.

**`windows_subsystem = "windows"`** links the binary as a GUI application rather than a console one. Without it, launching the app on Windows opens a black console window alongside the real window.

**`not(debug_assertions)` means release builds only** — in a debug build the console stays, so `println!` and panic output are visible during development. A genuinely useful conditional rather than a blanket setting.

## `fretnote_lib::run()`
**All the logic is in the library crate**, per [`Cargo.toml`](Cargo.toml.md)'s `[lib] name = "fretnote_lib"`. This file exists only to provide a `main` for the desktop target.

**Why the split:** Android doesn't call `main()` — it loads a shared library and calls a JNI entry point, which is what [`lib.rs`](lib.rs.md)'s `#[cfg_attr(mobile, tauri::mobile_entry_point)]` provides. Putting `run()` in `main.rs` would make it unreachable from Android. **One shared implementation, two entry mechanisms** — the standard Tauri 2 layout.

No conditionals, no loops, no error handling (`run()` panics on failure itself).

**Related:** [`lib.rs`](lib.rs.md), [`Cargo.toml`](Cargo.toml.md)
