# `src/lib/export.ts`

**Role:** Renders a note to plain text and to PDF, plus cross-platform clipboard and file-save.
**Size:** 327 lines. **Depends on:** `./types`, `./music/parse`, `./music/transpose`, `jspdf` (lazy), Tauri dialog/fs/clipboard plugins (lazy).

Two independent concerns share this file: **rendering** a note into a portable format, and the **platform plumbing** to get it out of the app.

---

## `noteHeaderLines(note)`

```ts
const lines: string[] = [];
lines.push(note.title);
lines.push(note.artist);
lines.push(`Key: ${note.key}${note.capo > 0 ? ` (Capo ${note.capo}, sounds like ${transposeKey(note.key, note.capo)})` : ""}`);
if (note.difficulty) lines.push(`Difficulty: ${note.difficulty}`);
if (note.tags.length > 0) lines.push(`Tags: ${note.tags.join(", ")}`);
if (note.bpm) lines.push(`BPM: ${note.bpm}`);
return lines;
```

**Title and artist are unconditional**; the rest are conditional. That reflects the schema — `title` and `artist` are `NOT NULL`, the others are optional or defaulted.

### The capo line — the one piece of real logic

```ts
`Key: ${note.key}${note.capo > 0 ? ` (Capo ${note.capo}, sounds like ${transposeKey(note.key, note.capo)})` : ""}`
```

**A capo raises every string by its fret number.** So a song *written* in Am with a capo at fret 2 *sounds* in Bm. Both facts matter to a player: the written key tells you which shapes to finger, the sounding key tells you whether it fits your voice or the other instruments.

`transposeKey(note.key, note.capo)` reuses [`transpose.ts`](music/transpose.ts.md) — capo position and semitone offset are the same unit, so no conversion is needed.

**`note.capo > 0`** — a capo at 0 is no capo, so the parenthetical is omitted entirely rather than printing "(Capo 0, sounds like Am)". Note `> 0` rather than truthiness would also be needed for a hypothetical negative value; `> 0` is the precise test.

**Nested template literal inside a ternary inside a template literal** — dense, but it keeps the whole line as one expression. The alternative (build a `capoSuffix` variable first) would read better.

**`if (note.difficulty)`** — always truthy in practice, since the column is `NOT NULL DEFAULT 'beginner'`. Defensive.

**`if (note.bpm)`** — here truthiness is *correct* rather than sloppy: `bpm: 0` is meaningless and should be omitted, and `bpm` is `number | undefined`.

---

## `noteBodyLines(note)`

```ts
if (note.chordSheet) lines.push(note.chordSheet);
```

**The chord sheet is emitted verbatim** — inline `[Am]` markers and all. Not parsed, not repositioned. That's the right call for plain text: the bracket notation *is* a readable plain-text format, and it round-trips (you can paste the export back into the editor). The PDF path below does the opposite — it parses and stacks chords above lyrics — because a PDF is for reading, not editing.

**A single `push` of a multi-line string.** The array holds "chunks", not strictly lines, and the final `join("\n")` works either way.

### The tab loop

```ts
for (const block of note.tabBlocks) {
  if (block.label) lines.push(`\n── ${block.label} ──`);
  // Columns are stored low-E first, but a tab reads high-e on the top line.
  TAB_STRING_LABELS.forEach((label, row) => {
    const string = 5 - row;
    const frets = block.columns.map((col) => col[string] || "-").join("-");
    lines.push(`${label}|${frets}|`);
  });
  ...
}
```

**`const string = 5 - row` is the storage→display flip** described in [`types.ts`](types.ts.md). `TAB_STRING_LABELS` is `["e","B","G","D","A","E"]` (high to low); `col` is indexed low-to-high. Row 0 draws label `"e"` and reads `col[5]`.

This is the **fifth** place in the codebase performing this reversal. Recognising `5 - i` on sight is a shortcut to reading any tab renderer here.

**`col[string] || "-"`** — an empty cell (`""`, meaning untouched) becomes a dash, the conventional tab filler. **`||` not `??`** here, and it must be: `""` is not nullish, so `??` would leave the cell blank and break the column alignment. One of the few places `||` is the correct operator.

**`.join("-")`** — one dash between every column, so a tab reads `e|--0--3--|`. Combined with the `||` filler, every column occupies at least two characters.

**The alignment flaw:** a two-digit fret (`"12"`) is wider than a one-digit fret, so columns containing double-digit frets shift the strings below out of alignment. Real tab renderers pad to a fixed width. This one doesn't — a known cosmetic limitation for tabs above fret 9.

**`\n── ${block.label} ──`** — the leading `\n` inside the string produces a blank line before each block once joined. Box-drawing characters (U+2500) as a divider.

### The hint

```ts
const shape = block.hint.shape ? `${block.hint.shape} shape` : "hand shape";
const grip = block.hint.frets
  .map((f, s) => `${TAB_STRING_LABELS[5 - s]}${f < 0 ? "x" : f}`)
  .join(" ");
lines.push(`Fingering: hold a ${shape} — ${grip}`);
if (block.hint.note) lines.push(`  ${block.hint.note}`);
```

**`shape ? \`${shape} shape\` : "hand shape"`** — produces `"hold a Em shape"` when named, `"hold a hand shape"` otherwise. The fallback reads slightly awkwardly but keeps the sentence grammatical.

**`TAB_STRING_LABELS[5 - s]`** — the same flip again, this time inside a `.map` over `hint.frets` (which is low-E-first). Output reads `e0 B0 G0 D2 A2 E0` — high string first, matching how the tab above it is drawn.

**`f < 0 ? "x" : f`** — `TabHint.frets` uses `-1` for muted (see [`types.ts`](types.ts.md)); `< 0` rather than `=== -1` is tolerant of any negative sentinel.

**`  ${block.hint.note}`** — two-space indent to nest the free-text note under the fingering line.

---

## `noteToText(note)`

```ts
return [...noteHeaderLines(note), "", ...noteBodyLines(note)].join("\n");
```

Header, a blank line, body. The `""` element becomes the blank separator once joined. Three-part composition in one expression.

---

## `copyTextToClipboard(text)`

> *"Copies text to the clipboard across every environment the app runs in: the Tauri desktop webview, a modern browser tab (phones included), and older/insecure contexts where the async Clipboard API is unavailable."*

**Three strategies, tried in order** — the same runtime-detection pattern as [`db-driver.ts`](db-driver.ts.md).

```ts
if ("__TAURI_INTERNALS__" in window) {
  const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
  await writeText(text);
  return;
}
```

**Tier 1 — the native plugin.** Dynamic import so the browser build never loads Tauri code. Early `return` so the rest is the implicit else.

```ts
if (navigator.clipboard?.writeText) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the legacy path below (e.g. insecure context).
  }
}
```

**Tier 2 — the async Clipboard API.**

**Both a feature check and a try/catch**, which looks redundant but isn't. `navigator.clipboard` is `undefined` on `http://` origins, so the optional chain handles that. But even when the object *exists*, `writeText` can reject — permission denied, or the call happening outside a user-gesture context. Detection and permission are separate failure modes and each needs its own guard.

**The catch falls through rather than rethrowing**, so a rejection degrades to tier 3 instead of failing.

```ts
const textarea = document.createElement("textarea");
textarea.value = text;
textarea.style.position = "fixed";
textarea.style.opacity = "0";
document.body.appendChild(textarea);
textarea.focus();
textarea.select();
const ok = document.execCommand("copy");
document.body.removeChild(textarea);
if (!ok) throw new Error("Copy failed");
```

**Tier 3 — the legacy `execCommand` hack.** The pre-Clipboard-API technique, and it's fiddly for reasons worth knowing:

- **A real DOM element is required.** `execCommand("copy")` copies the current *selection*, and you can only select text that's in the document.
- **`position: fixed`** takes it out of layout flow so appending it can't scroll the page or shift anything.
- **`opacity: 0`** hides it. Deliberately *not* `display: none` or `visibility: hidden` — an element with either is unfocusable and unselectable, and the copy would silently do nothing. This is the classic mistake in this technique.
- **`focus()` then `select()`** — both needed; `select()` alone doesn't reliably work on an unfocused element in every browser.
- **`removeChild` before the throw** — cleanup happens unconditionally, so a failed copy doesn't leave an orphan textarea in the DOM. Note this is achieved by ordering rather than `try`/`finally`; it works because nothing between append and remove can throw.

**`execCommand` returns a boolean**, not a promise — it's synchronous and deprecated. `if (!ok) throw` converts the boolean into the same error channel the other tiers use, so callers see one consistent contract: resolves = copied, rejects = didn't.

---

## `sanitizeFilename(name)`

```ts
return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "note";
```

**The character class is exactly Windows' set of forbidden filename characters**: `\ / : * ? " < > |`. Note `\\` is an escaped backslash inside the class. Being the strictest of the three platforms means one rule works everywhere.

**`|| "note"`** — the fallback for a title that sanitises to nothing (all-punctuation, or empty). Without it you'd get a file named `.pdf`. Correct use of `||`, since `""` is exactly what's being caught.

**`.trim()` before the fallback**, so a title of `"   "` also hits the default.

**Not handled:** length limits, reserved Windows device names (`CON`, `PRN`, `NUL`), or a leading dot. Edge cases a user is unlikely to hit with a song title.

---

## `chunkFixed(s, size)`

```ts
if (s.length <= size) return [s];
const out: string[] = [];
for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
return out;
```

> *"Splits a string into fixed-width slices **at the same offsets every time**, so a chord line and its lyric line stay column-aligned once wrapped."*

**The comment explains why this exists instead of jsPDF's own `splitTextToSize`.** That function wraps at *word boundaries*, which is right for prose and catastrophic here: the chord row and lyric row would break at different character offsets, and the chords would stop sitting above their syllables.

Chopping at fixed offsets guarantees that character *n* of the chord line and character *n* of the lyric line land in the same chunk at the same column. Words get split mid-syllable — which is exactly what a wrapped chord chart looks like anyway.

**`if (s.length <= size) return [s]`** — a fast path, and it also guarantees a non-empty result for an empty input (`[""]` rather than `[]`), which the caller's `Math.max(chordChunks.length, lyricChunks.length)` relies on.

**`i += size`** — a stepped loop. `slice` clamps past the end, so the final partial chunk needs no special case.

---

## `exportNoteAsPdf(note)`

> *"Renders a note straight to a PDF file client-side (no browser print dialog involved), so it works the same on desktop and on phones — where `window.print()` is unreliable or a no-op on many mobile browsers."*
>
> *"Laid out for black-and-white printing on letter paper: chords are set in bold instead of relying on color…"*

Two design constraints stated up front: **no print dialog** (phones), and **no colour** (printing). The second explains every `setFont(..., "bold")` you'll see where the on-screen UI would use `text-primary`.

### Setup

```ts
const { jsPDF } = await import("jspdf");
const doc = new jsPDF({ unit: "pt", format: "letter" });

const margin = 54;
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const maxWidth = pageWidth - margin * 2;
const bodySize = 10.5;
const lineHeight = 13;
let y = margin;
```

**Dynamic import of jspdf** — a large library loaded only when someone exports. Same code-splitting rationale as the DB drivers.

**`unit: "pt"`** — PostScript points, 72 per inch. `margin: 54` is exactly 0.75″. Using points rather than pixels means the layout is resolution-independent and matches how print is specified.

**`let y = margin`** — the cursor. **The entire renderer is a mutable `y` that only ever increases**, with `doc.addPage()` resetting it. That's the model: there's no layout engine, just "draw here, advance."

### The two helpers

```ts
const ensureSpace = (h: number) => {
  if (y + h > pageHeight - margin) { doc.addPage(); y = margin; }
};
```

**Manual pagination.** Called before drawing anything: "will this fit? if not, new page." `h` is the height about to be consumed.

Note it takes the *needed* height rather than checking after the fact — so an element is never half-drawn at a page break. `ensureSpace(lineHeight * 2)` before a tab block reserves room for the label plus at least one string, preventing an orphaned heading.

It closes over `y` and `doc` — the mutable-cursor pattern relies on the closure.

```ts
const resetBodyFont = () => {
  doc.setFont("courier", "normal");
  doc.setFontSize(bodySize);
};
```

**jsPDF's font state is global and sticky.** Every `setFont` persists until changed, so any code that switches to Helvetica for a heading *must* switch back or the next body line silently renders in the wrong face. This helper makes the restore a single call, and you'll see it after every heading.

**Courier for the body** — a monospace face, which is non-negotiable: the chord-above-lyric alignment depends entirely on every character being the same width.

### Header

Four blocks, each following the same shape: set font → `splitTextToSize` → loop and advance `y`.

```ts
doc.setFont("helvetica", "bold");
doc.setFontSize(20);
const titleLines = doc.splitTextToSize(note.title, maxWidth) as string[];
for (const titleLine of titleLines) { doc.text(titleLine, margin, y); y += 22; }
```

**`splitTextToSize` is used here** (unlike the body) because header text is prose — word-wrapping is correct and there's no alignment to preserve.

**`as string[]`** — jsPDF's types declare `string | string[]`; the array form is what's returned for multi-line input. A cast rather than a runtime check.

**Per-block line heights** — 22 for the 20pt title, 15 for the 12pt artist, 13 for 10pt meta, 12 for 9pt tags. Hand-tuned leading, roughly 1.1–1.3× the font size.

**No `ensureSpace` in the header** — it's assumed to fit on page 1. True unless a title is extraordinarily long.

```ts
const meta: string[] = [];
meta.push(`Key ${note.key}${note.capo > 0 ? ` (Capo ${note.capo}, sounds like ${transposeKey(note.key, note.capo)})` : ""}`);
if (note.difficulty) meta.push(note.difficulty[0].toUpperCase() + note.difficulty.slice(1));
if (note.bpm) meta.push(`${note.bpm} BPM`);
... doc.splitTextToSize(meta.join("     "), maxWidth)
```

**The capo expression is duplicated verbatim from `noteHeaderLines`.** Real duplication — a shared `capoLabel(note)` helper would be the fix. Worth noting because a change to one won't propagate.

**`difficulty[0].toUpperCase() + difficulty.slice(1)`** — manual capitalisation, since the stored value is lowercase. Would throw on an empty string, but the column is `NOT NULL DEFAULT 'beginner'`.

**`meta.join("     ")`** — five literal spaces as a separator, rather than a bullet or pipe. Fits the plain-B&W aesthetic.

```ts
doc.setTextColor(90);
...
doc.setTextColor(0);
```

**Grey (90/255) for tags, restored to black after.** Same sticky-state discipline as the fonts. Grey, not a colour — it survives black-and-white printing as a lighter tone.

```ts
y += 6;
doc.setDrawColor(0); doc.setLineWidth(1);
doc.line(margin, y, pageWidth - margin, y);
y += 20;
```

A horizontal rule separating header from body.

### Body setup

```ts
resetBodyFont();
const charWidth = doc.getTextWidth("0");
const maxChars = Math.max(20, Math.floor(maxWidth / charWidth));
```

**`getTextWidth("0")` measures one character** — valid only because the font is monospace, which `resetBodyFont()` has just guaranteed. Order matters: measuring before setting the font would measure Helvetica.

**`Math.floor(maxWidth / charWidth)`** — how many characters fit across the page. `floor` so a partial character doesn't overflow the margin.

**`Math.max(20, …)`** — a floor of 20 characters. Defensive against a pathological measurement (a font failing to load, `charWidth` near zero) producing a huge or zero `maxChars`, which would make `chunkFixed` loop forever or produce nonsense.

```ts
const tabByLabel = new Map(
  (note.tabBlocks ?? [])
    .filter((b) => b.label)
    .map((b) => [normalizeLabel(b.label as string), b] as const)
);
```

**An index for resolving `[tab: Name]` references.** Built once before the loop rather than scanning `tabBlocks` per reference — the same "build a lookup, then iterate" shape as `knownNamesByQuality` in [`chords.ts`](music/chords.ts.md).

**`normalizeLabel` = `trim().toLowerCase()`**, so `[tab: solo]` matches a block labelled `"Solo "`. Case-insensitive matching between author-typed reference and author-typed label — necessary, since nothing constrains either.

**`.filter(b => b.label)`** — unlabelled blocks can't be referenced. **`as const`** on the tuple so `new Map` infers `[string, TabBlock]` rather than `(string | TabBlock)[]`.

**Note this Map has the same non-uniqueness issue** as `TabBlock.label` generally: two blocks named "Solo" and the last wins.

### `drawTabBlock(block)`

A closure over `doc`/`y`, called from two places (the `type === "tab"` path and the `tabref` path) — which is exactly why it's a closure rather than inline code.

```ts
ensureSpace(lineHeight * 2);
if (block.label) { /* bold helvetica label */ resetBodyFont(); }
TAB_STRING_LABELS.forEach((label, row) => {
  const string = 5 - row;
  const frets = block.columns.map((col) => col[string] || "-").join("-");
  ensureSpace(lineHeight);
  doc.text(`${label}|${frets}|`, margin, y);
  y += lineHeight;
});
```

**The tab rendering is identical to `noteBodyLines`'s** — same `5 - row` flip, same `|| "-"` filler, same `join("-")`. Duplicated rather than shared, because one pushes to an array and the other draws to a page. A shared `tabBlockLines(block): string[]` would eliminate it.

**`ensureSpace(lineHeight)` inside the per-string loop** — so a six-line tab staff can break across a page boundary. Arguably wrong (a split staff is hard to read); reserving `lineHeight * 6` up front would keep it whole.

**No horizontal wrapping.** A tab wider than the page runs off the right edge — `maxChars` isn't applied here. A real limitation for long riffs.

**`y += 10`** at the end — spacing between blocks.

### The chord-sheet path

```ts
if (note.type === "tab") {
  for (const block of note.tabBlocks ?? []) drawTabBlock(block);
} else if (note.chordSheet) {
  for (const line of parseChordSheet(note.chordSheet)) { ... }
}
```

**The app's central `type` branch** (see [`types.ts`](types.ts.md)). Note `?? []` guards a tab note with no blocks, and `else if (note.chordSheet)` guards a chords note with no body — both cases the flat optional-field model permits.

**`parseChordSheet`** returns `ParsedLine[]`, and the loop is a four-way dispatch on `kind` — a direct consumer of [`parse.ts`](music/parse.ts.md)'s discriminated union.

```ts
if (line.kind === "blank") { y += lineHeight * 0.6; continue; }
```

**A blank line is 60% of a full line** — enough to read as a break, tighter than a full line so a sheet with many blanks doesn't sprawl.

```ts
if (line.kind === "section") {
  ensureSpace(lineHeight * 2);
  y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
  doc.text(line.label.toUpperCase(), margin, y);
  y += lineHeight + 4;
  resetBodyFont();
  continue;
}
```

**`.toUpperCase()`** — section headers rendered in caps. A typographic choice that substitutes for colour, per the B&W constraint. **`ensureSpace(lineHeight * 2)`** reserves room for the header *and* at least one line under it, so a heading never orphans at a page bottom. `y += 6` before, `+ 4` after — asymmetric padding, more space above than below, which visually groups the header with the content it introduces.

```ts
if (line.kind === "tabref") {
  const block = tabByLabel.get(normalizeLabel(line.name));
  if (block) drawTabBlock(block);
  continue;
}
```

**The inline tab feature.** A `[tab: Solo]` line inside a chord sheet renders the whole tab block at that point. **`if (block)`** — a reference to a nonexistent label draws nothing and doesn't error. Silent, which is arguably too quiet; the on-screen view could show a warning.

### The lyric line — the core layout

```ts
let chordLine = "";
let lyricLine = "";
for (const seg of line.segments) {
  const mark = seg.chord ?? seg.strum ?? "";
  if (mark) {
    chordLine = chordLine.padEnd(lyricLine.length, " ") + mark;
  }
  lyricLine += seg.text;
}
```

**This produces the classic two-row plain-text chord chart** — chords on one line, lyrics beneath, aligned by character column.

**`seg.chord ?? seg.strum ?? ""`** — the two are mutually exclusive per [`parse.ts`](music/parse.ts.md), so this picks whichever is set. `??` not `||`, so an empty-string chord would still be treated as present (it can't be, but the operator is consistent with the codebase's habits).

> *"jsPDF's core Courier font lacks the arrow glyphs used on-screen, so fall back to the plain stroke letter (D/U/d/u/X) here."*

The on-screen renderer uses `STROKE_DISPLAY`'s `↓`/`↑`/`✕`. Those are outside Courier's built-in encoding and would render as blanks or boxes. So the PDF prints the raw `StrokeType` character instead. A real font-capability constraint driving a rendering difference between two views of the same data.

**`chordLine.padEnd(lyricLine.length, " ") + mark` is the alignment mechanism**, and it's the cleverest line in the file. Read it as: *pad the chord row out to wherever the lyric row currently ends, then append the chord there.*

Because `lyricLine.length` is the character column at which this segment's text begins, padding to that length puts the chord at exactly that column.

```
segments: [Am]"Today is "  [C]"gonna be the "  [D]"day"

after seg 1:  chordLine = "Am"                     lyricLine = "Today is "
after seg 2:  chordLine = "Am       C"             lyricLine = "Today is gonna be the "
after seg 3:  chordLine = "Am       C             D"

              Am       C             D
              Today is gonna be the day
```

**`padEnd` only extends**, never truncates — so a chord longer than the gap before the next one (`[Amaj7]a`) pushes the following chord right rather than overwriting. Chords stay readable at the cost of drifting from perfect alignment. The right tradeoff.

**`if (mark)`** — a text-only segment (the `leading` segment from `parse.ts`) contributes to `lyricLine` but leaves `chordLine` alone, so no padding accumulates for chordless text.

### Wrapping and drawing

```ts
const hasChords = chordLine.trim().length > 0;
const chordChunks = chunkFixed(chordLine, maxChars);
const lyricChunks = chunkFixed(lyricLine || " ", maxChars);
const rows = Math.max(chordChunks.length, lyricChunks.length);
for (let i = 0; i < rows; i++) {
  const chordRow = chordChunks[i] ?? "";
  if (hasChords && chordRow.trim()) {
    ensureSpace(lineHeight);
    doc.setFont("courier", "bold");
    doc.text(chordRow, margin, y);
    doc.setFont("courier", "normal");
    y += lineHeight;
  }
  ensureSpace(lineHeight);
  doc.text(lyricChunks[i] ?? "", margin, y);
  y += lineHeight;
}
```

**`chunkFixed` on both rows at the same width** — the whole reason that function exists. Both are cut at identical offsets, so chunk *i* of the chords still sits above chunk *i* of the lyrics.

**`lyricLine || " "`** — a single space for an empty lyric line, so `chunkFixed` returns `[" "]` and the loop runs at least once. Without it, a chord-only line (`"[Am] [C]"` with no words) would produce zero lyric chunks, and `rows` would still be ≥1 from the chord side — so this is belt-and-braces rather than strictly required.

**`Math.max(chordChunks.length, lyricChunks.length)`** — iterate as far as the longer row. Normally equal, but the chord row can be longer when a trailing chord extends past the last lyric character.

**`chordChunks[i] ?? ""`** and **`lyricChunks[i] ?? ""`** — index past the end of the shorter array.

**`hasChords && chordRow.trim()`** — two separate conditions:
- **`hasChords`** — this line has any chords at all. Computed once, outside the loop.
- **`chordRow.trim()`** — *this chunk* has a non-blank chord. A wrapped line whose second chunk contains only padding spaces skips its chord row entirely, so no blank line is emitted.

Together: chord rows are drawn only where there's something to draw. The lyric row is drawn unconditionally.

**`setFont("courier", "bold")` then immediately back to `"normal"`** — chords in bold. The stated substitute for colour. Note the restore happens right after `doc.text`, not via `resetBodyFont()`, because only the weight changed and the size is already right.

**Two `ensureSpace` calls, one per row** — so a page break can fall between a chord row and its lyric row. That's a genuine layout bug: the chord would appear at the bottom of one page and its words at the top of the next. `ensureSpace(lineHeight * 2)` before the pair would fix it.

### Footer

```ts
const pageCount = doc.getNumberOfPages();
if (pageCount > 1) {
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    ...
    doc.text(`${note.title}   ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 30, { align: "right" });
    doc.setTextColor(0);
  }
}
```

> *"page numbers, only worth it once the chart runs long"*

**`if (pageCount > 1)`** — no "1 / 1" footer on a single-page chart. A small polish decision.

**Drawn last, in a second pass**, because the total page count isn't known until the body is complete. **`doc.setPage(i)`** jumps back to each page — jsPDF supports revisiting pages, which is what makes the two-pass approach possible.

**`i` is 1-based** — jsPDF's page numbering convention.

**`{ align: "right" }`** with `x = pageWidth - margin` — jsPDF right-aligns to the given x, so the text ends at the right margin.

**The title is repeated in the footer** — useful when pages get separated.

### Saving

```ts
const filename = `${sanitizeFilename(note.title)}.pdf`;

if ("__TAURI_INTERNALS__" in window) {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({ defaultPath: filename, filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (!path) return; // user cancelled the dialog
  await writeFile(path, new Uint8Array(doc.output("arraybuffer")));
  return;
}

doc.save(filename);
```

> *"The browser download machinery jsPDF's `doc.save()` relies on (a hidden `<a download>` click on a blob: URL) doesn't reliably trigger a save on Tauri's Linux webview (WebKitGTK), so drive a native save dialog + the fs plugin directly instead."*

**A concrete platform bug, documented.** `doc.save()` works in a browser and silently does nothing on WebKitGTK. The fix uses Tauri's native APIs directly.

**`if (!path) return`** — the save dialog returns `null` on cancel. Returning silently is correct: cancelling isn't an error.

**`new Uint8Array(doc.output("arraybuffer"))`** — jsPDF emits an `ArrayBuffer`; the fs plugin wants a typed array view.

**`doc.save(filename)` in the browser** — jsPDF's own download path, which works fine there.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `note.capo > 0 ? … : ""` | header ×2 | Omit "(Capo 0)"; duplicated between text and PDF |
| `if (note.bpm)` | header | Truthiness is *correct* here — 0 BPM is meaningless |
| `const string = 5 - row` | tab render ×2 | Storage (low-E first) → display (high-e top) |
| `col[string] \|\| "-"` | tab render ×2 | `\|\|` required — `""` isn't nullish |
| 3-tier `if` cascade | `copyTextToClipboard` | Tauri → Clipboard API → `execCommand` |
| feature check **and** `try/catch` | tier 2 | Existence and permission are separate failures |
| `opacity: 0`, not `display: none` | tier 3 | A hidden element can't be selected |
| `if (!ok) throw` | tier 3 | Convert a boolean API into the shared error channel |
| `\|\| "note"` | `sanitizeFilename` | Title that sanitises to nothing |
| `if (s.length <= size)` | `chunkFixed` | Fast path; also guarantees a non-empty result |
| `i += size` | `chunkFixed` | Fixed offsets — word-wrap would break alignment |
| `if (y + h > pageHeight - margin)` | `ensureSpace` | Manual pagination, checked *before* drawing |
| `resetBodyFont()` after every heading | throughout | jsPDF font state is global and sticky |
| `Math.max(20, …)` | `maxChars` | Guard against a pathological measurement |
| 4-way `kind` dispatch | body loop | Consumes `parse.ts`'s discriminated union |
| `padEnd(lyricLine.length, " ")` | lyric layout | The chord-above-syllable alignment mechanism |
| `hasChords && chordRow.trim()` | draw loop | Skip blank chord rows on wrapped continuations |
| `if (pageCount > 1)` | footer | No "1 / 1" |
| `if (!path) return` | save | Cancel isn't an error |

---

## Known rough edges

1. **The capo string is duplicated** between `noteHeaderLines` and the PDF meta block.
2. **The tab renderer is duplicated** between `noteBodyLines` and `drawTabBlock`.
3. **Double-digit frets break tab alignment** — no column padding.
4. **Tabs don't wrap horizontally** — wide blocks run off the page.
5. **A chord row can be orphaned from its lyric row** at a page break.
6. **A tab staff can split across pages** mid-string.

---

## Related

- [`lib/music/parse.ts`](music/parse.ts.md) — `parseChordSheet` and the `ParsedLine` union
- [`lib/music/transpose.ts`](music/transpose.ts.md) — `transposeKey` for the capo line
- [`lib/types.ts`](types.ts.md) — `TAB_STRING_LABELS` and the ordering convention
- [`lib/backup.ts`](backup.ts.md) — imports `sanitizeFilename`; the JSON counterpart to this file
- [`lib/strumming.ts`](strumming.ts.md) — `STROKE_DISPLAY`, whose glyphs Courier lacks
