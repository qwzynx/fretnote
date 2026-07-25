<div align="center">

# 🎸 Fretnote

**A local-first desktop & mobile songbook for guitarists.**
Write chord sheets and tabs with a real fretboard editor, keep everything searchable in one place, and never touch a server to do it.

[![Release](https://github.com/qwzynx/fretnote/actions/workflows/release.yml/badge.svg)](https://github.com/qwzynx/fretnote/actions/workflows/release.yml)
![Version](https://img.shields.io/badge/version-0.3.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)
![Platforms](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20macOS%20%7C%20Android-informational)
[![Last commit](https://img.shields.io/github/last-commit/qwzynx/fretnote)](https://github.com/qwzynx/fretnote/commits/main)

</div>

---

## Table of contents

- [What is Fretnote?](#what-is-fretnote)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [Supported tunings](#supported-tunings)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Data, storage & privacy](#data-storage--privacy)
- [Prerequisites](#prerequisites)
- [Development](#development)
- [Building](#building)
- [Releasing](#releasing)
- [Project layout](#project-layout)

## What is Fretnote?

Fretnote is a personal songbook app for guitar players. You write out a song once — lyrics with inline chords, or a tabbed-out riff — and Fretnote takes care of rendering chord diagrams, keeping tabs aligned, transposing on the fly, and organizing everything into a searchable library and setlists. It runs as a native desktop app (Linux, Windows, macOS) or on Android, all built from one Svelte + Tauri codebase, with zero backend: every song lives in a local SQLite database on the device.

## Features

### ✍️ Writing songs
- **Chord sheets** — write lyrics with inline chord markers (`[Am]Today is [C]gonna be...`) and Fretnote renders chord diagrams above the words automatically
- **Tab blocks** — label and store named tab fragments (Intro, Solo, Chorus riff, …) using a proper 6-string, column-based tab editor
- **Fretboard input** — click directly on a visual fretboard to build a chord voicing or a tab column, instead of typing fret numbers
- **Fingering hints** — attach a recommended hand shape (e.g. "Em shape, 5th fret") to a tab block so you know where to put your fingers before you play it
- **Strumming patterns** — compose a down/up/mute strumming pattern and display it alongside the BPM
- **Live preview** — see the rendered chord sheet / tab / diagrams update as you type, before saving

### 📖 Reading & playing
- **Note reader** — a distraction-free view for playing along, with adjustable font size and auto-scroll speed
- **Transpose** — shift a song's key up or down a semitone at a time; capo position is tracked and the "sounds like" key is shown automatically
- **Built-in metronome** — a click track driven by the note's BPM, right on the reader
- **Chord diagrams & fretboard legend** — every chord referenced in a note renders as a finger-position diagram, including barre chords

### 🗂️ Organizing a library
- **Feed view** — every saved note in one searchable, filterable, sortable list (by type, favorites, newest/oldest/title)
- **Search + tags** — free-text search across title, artist, and tags, plus a quick-search command palette (`Ctrl+K`)
- **Favorites** — star the songs you play most
- **Setlists** — group songs into ordered setlists for a gig or a practice session
- **Song metadata** — title, artist, key, capo, difficulty, tags, and BPM per note

### 📤 Import & export
- **PDF export** — render any note to a print-ready, black-and-white PDF (bold chords instead of color, so it photocopies cleanly)
- **`.fretnote` file format** — export a single note or your entire library (notes + setlists + memberships) to a portable JSON file
- **Library backup / restore** — merge a `.fretnote` library file back in without wiping local-only notes — the safe way to move your library between devices (e.g. phone → desktop)

### 📱 Cross-platform
- Same codebase runs as a native desktop app and as an Android app
- Responsive layout with phone-specific navigation: bottom nav, back-navigation, and drag-to-dismiss overlays on small screens

## Tech stack

| Layer | Choice |
|---|---|
| App shell | [Tauri 2](https://tauri.app/) (Rust) — desktop + Android from one codebase |
| Frontend | [Vite 8](https://vitejs.dev/) + [Svelte 5](https://svelte.dev/) + TypeScript |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Routing | [svelte-spa-router](https://github.com/ItalyPaleAle/svelte-spa-router) |
| Storage | SQLite via [`@tauri-apps/plugin-sql`](https://v2.tauri.app/plugin/sql/) |
| PDF export | [jsPDF](https://github.com/parallax/jsPDF) |
| Native bridges | `plugin-fs`, `plugin-dialog`, `plugin-clipboard-manager` |

Fretnote is intentionally backend-light: nearly all data logic (`src/lib/db.ts`) lives in TypeScript, and the Rust side of the app is just the Tauri shell + plugins.

## Data model

Each song is a **Note** — either a `chords` note (lyrics + inline chord markers, with tab blocks referenced inline via `[tab: Label]`) or a `tab` note (one or more labeled `TabBlock`s). A `TabBlock` is a list of 6-string columns (low‑E to high‑e) plus an optional fingering `TabHint`. Notes carry their own `key`, `capo`, `difficulty`, `tags`, `bpm`, and an optional strumming pattern; `Setlist`s reference notes by id in an ordered list. See `src/lib/types.ts` for the full shape.

## Supported tunings

Standard · Drop D · Half Step Down · Full Step Down · Open G · DADGAD · Open E · Open D

(`src/lib/music/tunings.ts` — each tuning defines open-string MIDI notes so chord/tab rendering and transposition stay in sync with the neck.)

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl N` | New note |
| `Ctrl K` | Quick search |
| `Ctrl S` | Save note |
| `Space` | Toggle auto-scroll (reader) |
| `[` / `]` | Transpose down / up (reader) |
| `-` / `+` | Smaller / larger text (reader) |
| `?` | Show the shortcuts help overlay |
| `Esc` | Close / dismiss |

On macOS, use `⌘` instead of `Ctrl`. Full list available in-app via `?`.

## Data, storage & privacy

Everything is stored locally — there's no account, no server, and no telemetry.

- **Desktop (Linux)**: `~/.local/share/com.fretnote.app/fretnote.db`
- The exact path follows Tauri's per-OS app-data convention on Windows/macOS/Android.
- Use **Export library** / **Import library** in Settings to move your whole songbook between devices as a single `.fretnote` file, or **Export note** / **Import note** to share just one song.

## Prerequisites

**Rust + Cargo** — install via [rustup](https://rustup.rs/)

**WebKitGTK** (Linux only):
```bash
sudo pacman -S webkit2gtk-4.1 base-devel                 # Arch
sudo apt install libwebkit2gtk-4.1-dev build-essential   # Ubuntu/Debian
```

**Node.js** 18+

**Android builds** additionally need the Android SDK/NDK and a JDK 17 — see `.github/workflows/release.yml` for the exact toolchain versions used in CI.

## Development

```bash
npm install
npm run dev        # starts Vite + opens the Tauri desktop window
```

Other useful scripts:

```bash
npm run check       # svelte-check (type checking)
npm run lint        # eslint
npm run vite:dev     # frontend only, no Tauri window
```

## Building

```bash
npm run build       # produces a native installer in src-tauri/target/release/bundle/
```

For Android, use the Tauri CLI directly:

```bash
npm run tauri android init    # one-time
npm run tauri android build -- --apk
```

## Releasing

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds installers for Linux (`.AppImage`, `.deb`), Windows (`.exe`/`.msi`), macOS (`.dmg`, Intel + Apple Silicon), and a signed Android `.apk`, then attaches them all to a draft GitHub release.

## Project layout

```
src/
  App.svelte             # router setup
  pages/                  # FeedPage, CreatePage, NotePage, SetlistPage(s), SettingsPage
  components/
    create/               # note creation form, fretboard input, tab editor, strumming editor
    notes/                # chord diagram, chord-lyrics view, tab view, metronome, note card, reader
    feed/                 # searchable/filterable song list
    layout/               # header, footer, bottom nav (mobile)
    ui/                   # shared UI primitives (button, card, select, popover, ...)
  lib/
    db.ts                 # SQLite CRUD — all data logic lives here
    types.ts               # Note, TabBlock, TabColumn, Setlist types
    music/                 # chord shapes, chord detection, parsing, transposing, tunings, tab fingering
    setlists.ts             # setlist helpers
    settings.ts             # user settings (persisted to localStorage)
    export.ts               # plain-text + PDF export
    backup.ts               # .fretnote library/note import & export
src-tauri/                # Rust backend (minimal — data logic is JS-side)
.github/workflows/        # tagged-release build pipeline (desktop + Android)
```
