# Fretnote teardown

One document per source file, explaining **how** it works and **why** it's built that way — every function, branch, and loop.

**93 documents. Read in the order below**, not alphabetically: each layer is built on the one above it.

---

## Before anything else

**[`lib/types.ts`](lib/types.ts.md)** — the domain vocabulary. `Note`, `TabBlock`, `TabColumn`, `TabHint`, `Setlist`. Every other file speaks in these nouns, and it establishes the **low-E-first string ordering convention** that is the single most common source of confusion in this codebase.

---

## 1 · Foundation

| File | What it teaches |
|---|---|
| [`main.ts`](main.ts.md) | Entry point; why the DB is *not* awaited here |
| [`vite-env.d.ts`](vite-env.d.ts.md) | Ambient types; why the CSS import compiles |
| [`lib/utils.ts`](lib/utils.ts.md) | `cn()` — clsx + tailwind-merge, and why the order matters |
| [`lib/settings.ts`](lib/settings.ts.md) | The settings-vs-data boundary; forward-compatible merge |
| [`lib/media.svelte.ts`](lib/media.svelte.ts.md) | `.svelte.ts` runes-outside-components; the getter that makes reactivity work |
| [`lib/search-open.svelte.ts`](lib/search-open.svelte.ts.md) | The smallest complete cross-component store |
| [`lib/card-actions.svelte.ts`](lib/card-actions.svelte.ts.md) | The "single-open" pattern — why the state is an **id**, not a boolean |
| [`lib/sections.ts`](lib/sections.ts.md) | An unenforced invariant between two files |
| [`lib/recent.ts`](lib/recent.ts.md) | MRU list; deliberately different error policy from `settings.ts` |
| [`lib/strumming.ts`](lib/strumming.ts.md) | Exhaustiveness via `Record<Union, …>`; case-sensitive codes |

## 2 · Data layer

| File | What it teaches |
|---|---|
| **[`lib/db-driver.ts`](lib/db-driver.ts.md)** | **The highest-value file in the repo.** Platform branching, the whole schema, migrations, and *why you memoise the promise, not the value* |
| [`lib/db-driver.web.ts`](lib/db-driver.web.ts.md) | sql.js + OPFS; write-coalescing; freeing WASM memory |
| [`lib/db.ts`](lib/db.ts.md) | Every notes query. Why `OR` across two indexed columns is a full table scan |
| [`lib/setlists.ts`](lib/setlists.ts.md) | `LEFT JOIN` + `COUNT(col)`; the `_itemId` type-smuggle |

## 3 · Music theory — pure functions, no I/O

| File | What it teaches |
|---|---|
| [`lib/music/tunings.ts`](lib/music/tunings.ts.md) | Why MIDI numbers: `tuning.midi[s] + fret` is the entire fretboard model |
| [`lib/music/transpose.ts`](lib/music/transpose.ts.md) | The JS modulo trap; enharmonic spelling; **a confirmed `[Bridge]` → `[C#ridge]` bug** |
| [`lib/music/parse.ts`](lib/music/parse.ts.md) | The notation parser; `/g` regex statefulness; chord-vs-section disambiguation |
| [`lib/music/chords.ts`](lib/music/chords.ts.md) | Three memoisation layers; negative caching; loop order as a musical decision |
| [`lib/music/chord-detect.ts`](lib/music/chord-detect.ts.md) | A scored search where the **weights encode guitar practice** |
| [`lib/music/fingering.ts`](lib/music/fingering.ts.md) | How a hand works, in code. `FRET_SPAN = 4` |
| [`lib/music/tab-shapes.ts`](lib/music/tab-shapes.ts.md) | "Where do I put my hand?" — a six-key comparator |

## 4 · Services

| File | What it teaches |
|---|---|
| [`lib/export.ts`](lib/export.ts.md) | Plain-text + PDF; `padEnd` chord alignment; three-tier clipboard |
| [`lib/backup.ts`](lib/backup.ts.md) | The `.fretnote` format; **the only place foreign data is properly validated** |
| [`lib/lyrics.ts`](lib/lyrics.ts.md) | The only network code; Dice coefficient; a three-provider cascade |

## 5 · Navigation & gestures — **the hardest part**

Read `overlay-history` first; `nav-stack` registers into it.

| File | What it teaches |
|---|---|
| [`lib/overlay-history.svelte.ts`](lib/overlay-history.svelte.ts.md) | Back closes overlays before it navigates. The double-unwind guard |
| **[`lib/nav-stack.svelte.ts`](lib/nav-stack.svelte.ts.md)** | **The hardest file.** A canonical back stack; how to tell a back press from any other `popstate` |
| [`lib/actions/drag-dismiss.ts`](lib/actions/drag-dismiss.ts.md) | Touch events over Pointer Events, and why; `passive` flags |
| [`lib/actions/swipe-horizontal.ts`](lib/actions/swipe-horizontal.ts.md) | Mirrored axis tests — how two gesture actions arbitrate without knowing each other |

## 6 · App shell

[`App.svelte`](App.svelte.md) · [`app/globals.css`](app/globals.css.md)

`globals.css` is the whole design system, and its comments read as **a changelog of design debt being paid down** — the best single argument for a token system in the repo.

## 7 · Pages

[`FeedPage`](pages/FeedPage.svelte.md) · [`CreatePage`](pages/CreatePage.svelte.md) · [`NotePage`](pages/NotePage.svelte.md) · [`SettingsPage`](pages/SettingsPage.svelte.md) · [`SetlistsPage`](pages/SetlistsPage.svelte.md) · [`SetlistPage`](pages/SetlistPage.svelte.md)

## 8 · UI primitives

[`Button`](components/ui/Button.svelte.md) · [`Badge`](components/ui/Badge.svelte.md) · [`Card`](components/ui/Card.svelte.md) · [`CardContent`](components/ui/CardContent.svelte.md) · [`CardFooter`](components/ui/CardFooter.svelte.md) · [`Input`](components/ui/Input.svelte.md) · [`Label`](components/ui/Label.svelte.md) · [`Select`](components/ui/Select.svelte.md) · [`Slider`](components/ui/Slider.svelte.md) · [`Separator`](components/ui/Separator.svelte.md) · [`Skeleton`](components/ui/Skeleton.svelte.md) · [`EmptyState`](components/ui/EmptyState.svelte.md) · [`Popover`](components/ui/Popover.svelte.md) · [`AddToSetlistDialog`](components/ui/AddToSetlistDialog.svelte.md)

Start with `Card` (the wrapper pattern), then `Badge` (`cva`), then `Button`. `Popover` is the technically hardest.

## 9 · Layout & feed

[`SiteHeader`](components/layout/SiteHeader.svelte.md) · [`SiteFooter`](components/layout/SiteFooter.svelte.md) · [`BottomNav`](components/layout/BottomNav.svelte.md) · [`SectionSwipe`](components/layout/SectionSwipe.svelte.md) · [`FeedClient`](components/feed/FeedClient.svelte.md) · [`NoteCardSkeleton`](components/feed/NoteCardSkeleton.svelte.md) · [`SearchPalette`](components/SearchPalette.svelte.md) · [`KeyboardShortcutsHelp`](components/KeyboardShortcutsHelp.svelte.md)

## 10 · Note rendering

[`NoteCard`](components/notes/NoteCard.svelte.md) · [`NoteReader`](components/notes/NoteReader.svelte.md) · [`ChordLyricsView`](components/notes/ChordLyricsView.svelte.md) · [`ChordDiagram`](components/notes/ChordDiagram.svelte.md) · [`FingerFretboard`](components/notes/FingerFretboard.svelte.md) · [`FingerLegend`](components/notes/FingerLegend.svelte.md) · [`TabView`](components/notes/TabView.svelte.md) · [`TabHintView`](components/notes/TabHintView.svelte.md)

## 11 · The editor

[`CreateNoteForm`](components/create/CreateNoteForm.svelte.md) *(628 lines, four documented bugs)* · [`NotePreview`](components/create/NotePreview.svelte.md) · [`ChordPanel`](components/create/ChordPanel.svelte.md) · [`FretboardInput`](components/create/FretboardInput.svelte.md) · [`TabEditor`](components/create/TabEditor.svelte.md) · [`TabFingeringPanel`](components/create/TabFingeringPanel.svelte.md) · [`StrummingEditor`](components/create/StrummingEditor.svelte.md) · [`StrummingPreview`](components/create/StrummingPreview.svelte.md) · [`StrumPanel`](components/create/StrumPanel.svelte.md) · [`TagInput`](components/create/TagInput.svelte.md)

## 12 · Rust, build & tooling

[`lib.rs`](tauri/lib.rs.md) *(21 lines — the entire backend)* · [`main.rs`](tauri/main.rs.md) · [`Cargo.toml`](tauri/Cargo.toml.md) · [`tauri.conf.json`](tauri/tauri.conf.json.md)

[`index.html`](config/index.html.md) · [`vite.config.ts`](config/vite.config.ts.md) · [`tsconfig.json`](config/tsconfig.json.md) · [`svelte.config.js`](config/svelte.config.js.md) · [`postcss.config.mjs`](config/postcss.config.mjs.md) · [`package.json`](config/package.json.md) · [`eslint.config.mjs`](config/eslint.config.mjs.md) · [`vercel.json`](config/vercel.json.md) · [`release.yml`](config/release.yml.md)

[`verify-schema.mjs`](scripts/verify-schema.mjs.md) · [`check-nav.mjs`](scripts/check-nav.mjs.md) · [`shoot.mjs`](scripts/shoot.mjs.md)

---

## Recurring patterns worth learning once

Each appears in many files; learn it once and those files get easy.

**The string-ordering flip.** Storage is low-E-first; tabs display high-e on top. The reversal appears five ways: `TAB_STRING_LABELS`, `ROW_TO_STRING`, `DISPLAY_ORDER`, `5 - row`, and a descending `for` loop. Chord *diagrams* don't flip — they're drawn low-E on the left. See [`types.ts`](lib/types.ts.md).

**`$derived.by`, not `$derived(fn)`.** `$derived(expr)` memoises `expr`'s value; hand it an arrow function and it memoises the *function*, which never changes, so nothing is ever cached. Documented as a fixed bug in [`FeedPage`](pages/FeedPage.svelte.md) and [`FeedClient`](components/feed/FeedClient.svelte.md). **The most common Svelte 5 runes mistake.**

**`!== undefined`, not truthiness.** Recurs wherever `0`, `""`, or `null` is a legitimate value: [`transpose.ts`](lib/music/transpose.ts.md) (A is index 0), [`chords.ts`](lib/music/chords.ts.md) (a cached miss is `null`), [`parse.ts`](lib/music/parse.ts.md) (which regex group matched).

**`??` vs `||`.** `??` almost everywhere, so `0` and `""` survive. `||` deliberately where empty *is* the case being caught — `slug || id`, `col[s] || "-"`, `anchors[i] || undefined`.

**Runtime platform detection.** `"__TAURI_INTERNALS__" in window` in [`db-driver.ts`](lib/db-driver.ts.md), [`export.ts`](lib/export.ts.md), [`backup.ts`](lib/backup.ts.md) — plus `await import()` so each platform only downloads its own half.

**`min-h-0` on a flex scroll container.** A flex item won't shrink below its content without it, so `overflow-y-auto` never engages. [`App.svelte`](App.svelte.md), [`CreatePage`](pages/CreatePage.svelte.md), and three more.

**Optimistic local updates.** `notes = notes.map(...)` rather than a refetch, everywhere. Reassignment, never mutation.

---

## The bugs the code itself documents

Roughly twenty comments in this codebase are bug reports. The best:

- **Promise memoisation** — caching the resolved driver instead of the promise let three phone panes each open their own database ([`db-driver.ts`](lib/db-driver.ts.md)).
- **`OR` across two indexed columns** doesn't use either index — every note open scanned the whole library ([`db.ts`](lib/db.ts.md)).
- **`popstate` isn't always "back"** — typing `#/settings` from `#/create` landed you on the feed ([`nav-stack.svelte.ts`](lib/nav-stack.svelte.ts.md)).
- **`history.go(-N)` fires one popstate, not N** ([`overlay-history.svelte.ts`](lib/overlay-history.svelte.ts.md)).
- **`$derived(fn)` memoises the function** — every keystroke re-sorted the whole library four times ([`FeedClient`](components/feed/FeedClient.svelte.md)).
- **Inferring `noteType` from content** — clearing the lyrics field silently turned a chord sheet into a tab ([`CreateNoteForm`](components/create/CreateNoteForm.svelte.md)).
- **Reduced-motion + infinite animation** — the global `0.01ms` rule turns an infinite sweep into a strobe ([`Skeleton`](components/ui/Skeleton.svelte.md)).
- **Fonts from a CDN in an offline-first app** ([`globals.css`](app/globals.css.md)).

**One bug found during this teardown and verified by running the module:** `transposeChordSheet` mangles section headers whose first letter is A–G. `[Bridge]` +2 → `[C#ridge]`, `[Chorus]` → `[Dhorus]`. The parser has an `isNonChordLabel` filter for exactly this; the transposer doesn't use it. See [`transpose.ts`](lib/music/transpose.ts.md).

---

## Verifying things yourself

The music layer is pure functions with no I/O, so any of it runs standalone:

```bash
npx esbuild src/lib/music/transpose.ts --bundle --format=esm --outfile=/tmp/t.mjs
node -e 'import("/tmp/t.mjs").then(m => console.log(m.transposeChordSheet("[Bridge]", 2)))'
```

The repo's own checks drive the real app rather than importing modules — deliberately, for reasons [`check-nav.mjs`](scripts/check-nav.mjs.md) explains well:

```bash
node scripts/verify-schema.mjs    # real DDL against real SQLite
npm run vite:dev:web              # then, in another terminal:
node scripts/check-nav.mjs http://localhost:1421
node scripts/shoot.mjs http://localhost:1421 /tmp/shots
```

**The fastest way to confirm you understand a file is to break it.** Most docs end with suggested experiments. `git restore .` undoes everything.
