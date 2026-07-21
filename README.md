# Fretnote

A personal desktop songbook for guitarists. Store and read your chord sheets and tabs — all data lives locally, no account required.

## Features

- **Chord sheets** — write lyrics with inline chord markers (`[Am]Today is [C]gonna be...`), auto-renders chord diagrams above the words
- **Tab blocks** — label and store named tab fragments (Intro, Solo, Chorus riff, etc.) with a 6-string fretboard editor
- **Fretboard input** — click a visual fretboard to build chord voicings
- **Song metadata** — title, artist, key, capo, difficulty, and tags per note
- **Feed view** — browse all saved notes with search/filter

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | Vite 8 + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn (base-ui) |
| Routing | React Router v7 |
| Storage | SQLite via `tauri-plugin-sql` |

Data is stored at `~/.local/share/com.fretnote.app/fretnote.db` on Linux.

## Prerequisites

**Rust + Cargo** — install via [rustup](https://rustup.rs/)

**WebKitGTK** (Linux only):
```bash
sudo pacman -S webkit2gtk-4.1 base-devel   # Arch
sudo apt install libwebkit2gtk-4.1-dev build-essential  # Ubuntu/Debian
```

**Node.js** 18+

## Development

```bash
npm install
npm run dev        # starts Vite dev server + Tauri window
```

## Build

```bash
npm run build      # produces a native installer in src-tauri/target/release/bundle/
```

## Project layout

```
src/
  App.tsx              # router setup
  pages/               # FeedPage, CreatePage, NotePage
  components/
    create/            # note creation form, fretboard input, tab editor
    notes/             # chord diagram, chord-lyrics view, tab view, note card
    feed/              # song list
    layout/            # header, footer
    ui/                # shadcn primitives
  lib/
    db.ts              # SQLite CRUD (all data logic lives here)
    types.ts           # Note, TabBlock, TabColumn types
src-tauri/             # Rust backend (minimal — data logic is JS-side)
```
