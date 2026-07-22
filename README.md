# Fretnote

A personal desktop songbook for guitarists. Store and read your chord sheets and tabs — all data lives locally, no account required.

A native **Rust + [Slint](https://slint.dev)** application (previously a Tauri/React app).

## Features

- **Chord sheets** — lyrics with inline chord markers (`On a dark [Em]desert highway`) render chords positioned above the words
- **Chord diagrams** — every chord used is drawn as a fretboard diagram (with barre/base-fret support)
- **Transpose** — shift the whole sheet up/down by semitones; the key label, chords, and diagrams update live
- **Tab blocks** — named tab fragments (Intro, Solo, …) rendered as monospace ASCII staves, pulled inline via `[tab: Label]`
- **Song metadata** — title, artist, key, capo, difficulty, and tags per note
- **Feed view** — browse all saved notes with search/filter

> The note **editor** (create/edit form, visual fretboard input, tab/strumming editors) is being ported next. The data layer already supports create/update/delete.

## Tech stack

| Layer | Choice |
|---|---|
| Language | Rust |
| UI | Slint (declarative `.slint` files) |
| Storage | SQLite via [`rusqlite`](https://crates.io/crates/rusqlite) (bundled) |

Data is stored at `~/.config/com.fretnote.app/fretnote.db` on Linux — the same
file and schema the previous Tauri build used, so existing notes carry over.

## Prerequisites

**Rust + Cargo** — install via [rustup](https://rustup.rs/).

On Linux, Slint needs the usual GUI/graphics dev packages (Wayland or X11); on a
typical desktop these are already present.

## Development

```bash
cargo run          # build and launch the app
cargo test         # run the music-theory + data-layer unit tests
```

## Build

```bash
cargo build --release   # optimized binary at target/release/fretnote
```

## Project layout

```
build.rs               # compiles ui/app.slint
src/
  main.rs              # DB init, Slint callbacks, event loop
  model.rs             # Note, TabBlock, TabColumn, NoteType, Difficulty
  db.rs                # rusqlite CRUD (same schema/path as the old app)
  bridge.rs            # Rust domain model -> flat Slint view structs
  music/               # transpose, chords, chord_detect, parse, tunings (pure, unit-tested)
ui/
  app.slint            # window, Store global, feed + reader views
  theme.slint          # colors / sizing tokens
  structs.slint        # UI data structs shared across .slint files
  chord-diagram.slint  # fretboard diagram component
```
