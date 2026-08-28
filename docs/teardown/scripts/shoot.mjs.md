# `scripts/shoot.mjs`
**Role:** Seeds a library and screenshots every surface at phone and desktop widths. **~130 lines.**

> *"Drives the running dev server in a real browser, seeds a library **through the app's own data layer**, and screenshots each surface at phone and desktop widths. Used to check design work against **what actually renders** rather than against the markup."*

## Seeding through the app's own data layer
The key decision: rather than writing SQLite directly, the script evaluates code **in the page** that calls the app's own `createNote`. So the fixtures go through [`db.ts`](../lib/db.ts.md)'s real insert path — same slug generation, same JSON serialisation, same schema. **A fixture that can't drift from the app**, the same principle as [`verify-schema.mjs`](verify-schema.mjs.md) extracting real SQL.

## The fixtures
```js
const SONGS = [
  ["Wonderwall", "Oasis", "Em", 2, "beginner", ["britpop","acoustic"], 87],
  ["Hotel California", "Eagles", "Bm", 7, "advanced", ["classic"], 74],
  ["Blackbird", "The Beatles", "G", 0, "advanced", ["fingerstyle"], 96],
  …
];
```
**Nine real songs, chosen to exercise the rendering.** Not `["Test 1", "Artist 1"]` — and the difference matters for a screenshot harness:

- **Varied title lengths** — "Black" vs "Nothing Else Matters" tests truncation and card height.
- **Capo 0, 2, 5, 7** — so the "Capo N / Sounds like X" badges in [`NotePage`](../pages/NotePage.svelte.md) actually appear.
- **All three difficulties**, varied tags, varied BPM.
- **Minor and major keys** (`Em`, `Bm`, `G`) so transposition is visible.

A uniform fixture would produce screenshots where every card is the same width — and the layout bugs you're screenshotting for are exactly the ones uneven data reveals.

**`SHEET`** is a realistic chord sheet with `[Intro]` and `[Verse 1]` section headers and inline `[Em]` markers — so it exercises all four `ParsedLine` kinds through [`parse.ts`](../lib/music/parse.ts.md).

**Note that `[Intro]` in the fixture is precisely the kind of label affected by the transpose bug** documented in [`transpose.ts`](../lib/music/transpose.ts.md) — though `I` is outside A–G, so it survives. A fixture with `[Bridge]` would surface it in a screenshot.

## Mechanics
**`mkdirSync(OUT, { recursive: true })`** — `recursive` also makes it idempotent (no error if the directory exists).

**Two viewport widths** per surface, so phone and desktop layouts are captured together — the two branches of every `sm:` class in the codebase.

**Output defaults to `/tmp/shots`**, both args overridable: `node scripts/shoot.mjs [baseUrl] [outDir]`.

**This is a design tool, not a test** — nothing asserts. It produces images for a human to look at, which is the right instrument for verifying visual work.

**Related:** [`lib/db.ts`](../lib/db.ts.md), [`check-nav.mjs`](check-nav.mjs.md), [`app/globals.css`](../app/globals.css.md)
