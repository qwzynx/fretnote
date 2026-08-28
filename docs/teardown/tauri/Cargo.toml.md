# `src-tauri/Cargo.toml`
**Role:** The Rust crate manifest.

## `[lib]`
```toml
[lib]
name = "fretnote_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```
**Three crate types, one per platform:**
- **`staticlib`** — a static archive, for iOS.
- **`cdylib`** — a C-ABI shared library (`.so`), **what Android loads and calls the JNI entry point in**. This is why [`lib.rs`](lib.rs.md)'s `mobile_entry_point` exists.
- **`rlib`** — the native Rust library format, so [`main.rs`](main.rs.md) can `use fretnote_lib::run`.

**`name = "fretnote_lib"`** — distinct from the package name so the lib and bin targets don't collide.

## Dependencies
```toml
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-clipboard-manager = "2.3.2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```
**`features = ["sqlite"]` on the SQL plugin** selects the backend — it also supports MySQL and Postgres, which would pull in large drivers. One feature flag keeps the binary lean.

**`serde` and `serde_json` are direct dependencies but unused by this crate's own code** — there are no `#[tauri::command]` functions to serialise. Almost certainly template residue; removable.

**`features = []` on `tauri`** — no default features. Nothing custom is needed because there's no custom IPC.

Four plugins here, four `.plugin()` calls in `lib.rs`. **The dependency list *is* the app's native capability list.**

## `[profile.release]`
```toml
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```
**All five settings trade compile time for binary size** — the right priority for a desktop app that ships as a download, and especially for Android:

- **`codegen-units = 1`** — compile the crate as one unit, so LLVM can optimise across all of it. Much slower to build.
- **`lto = true`** — link-time optimisation across crate boundaries; the biggest single size win.
- **`opt-level = "s"`** — optimise for size rather than the default `3` (speed). Correct here: the Rust side is a window host, not a hot path. All the app's real work is in the WebView.
- **`panic = "abort"`** — no unwinding machinery, so the panic tables are dropped. Safe because [`lib.rs`](lib.rs.md) `.expect()`s and there is nothing to recover.
- **`strip = true`** — remove debug symbols.

**Together these explain why `src-tauri/target/` is enormous while the shipped binary is small** — and why a clean rebuild takes minutes.

**Related:** [`lib.rs`](lib.rs.md), [`main.rs`](main.rs.md), [`tauri.conf.json`](tauri.conf.json.md)
