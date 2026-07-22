# Fretnote — agent notes

Native **Rust + Slint** desktop app (no Node/web stack).

- UI lives in `ui/*.slint`; `build.rs` compiles `ui/app.slint`. Rust reads the
  generated types via `slint::include_modules!()` in `src/main.rs`.
- Pure domain logic (music theory, parsing, data layer) is in `src/music/`,
  `src/model.rs`, `src/db.rs` and is covered by unit tests — run `cargo test`.
- `src/bridge.rs` flattens the Rust domain model into the Slint view structs
  defined in `ui/structs.slint`. Keep `.slint` files declarative; do derivations
  (parse/transpose/shape lookup) in Rust.
- SQLite data lives at `~/.config/com.fretnote.app/fretnote.db`. Preserve the
  schema and JSON-encoded columns (`tags`, `tab_blocks`, `chords`,
  `strumming_pattern`) — existing user data depends on it.
- Consult the Slint docs before using unfamiliar APIs; note that a plain
  `Rectangle` **centers** its children and doesn't size to absolutely-placed
  children — use layouts for stacking/left-alignment.
