# Fretnote

A personal desktop songbook for guitarists. Store and read your chord sheets and tabs — all data lives locally, no account required.

## Features

- **Chord sheets** — write lyrics with inline chord markers (`[Am]Today is [C]gonna be...`), auto-renders chord diagrams above the words
- **Tab blocks** — label and store named tab fragments (Intro, Solo, Chorus riff, etc.) with a 6-string fretboard editor
- **Fretboard input** — click a visual fretboard to build chord voicings
- **Strumming patterns** — compose and display strumming notation per song
- **Transpose** — shift a song's key up or down on the fly
- **Setlists** — group songs into ordered setlists
- **Metronome** — built-in click track on the note reader
- **Song metadata** — title, artist, key, capo, difficulty, and tags per note
- **Feed view** — browse all saved notes with search/filter
- **Export** — export notes to a portable format

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | Vite 8 + Svelte 5 + TypeScript |
| Styling | Tailwind CSS v4 |
| Routing | svelte-spa-router |
| Storage | SQLite via `@tauri-apps/plugin-sql` |

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
  App.svelte             # router setup
  pages/                 # FeedPage, CreatePage, NotePage, SetlistPage, SettingsPage
  components/
    create/              # note creation form, fretboard input, tab editor, strumming editor
    notes/               # chord diagram, chord-lyrics view, tab view, metronome, note card
    feed/                # song list
    layout/              # header, footer
    ui/                  # shared UI primitives
  lib/
    db.ts                # SQLite CRUD (all data logic lives here)
    types.ts             # Note, TabBlock, TabColumn, Setlist types
    music/               # chord detection, parsing, transposing, tunings
    setlists.ts          # setlist helpers
    settings.ts          # user settings
    export.ts            # export logic
src-tauri/               # Rust backend (minimal — data logic is JS-side)
```
