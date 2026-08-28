# `src/components/create/CreateNoteForm.svelte`
**Role:** The note editor — every field, both body types, live preview, save. **628 lines, the largest file in the repo.**

**Four bugs are recorded in its comments.** Those are the fastest way in.

## Bug 1 — colliding tab-block ids
```ts
// Ids are minted globally unique rather than from a per-form counter. The
// counter started at 0 on every mount, so editing a note whose blocks were
// already saved as tab-1, tab-2… made the next "Add tab" collide with an
// existing id — a duplicate key in the keyed {#each} below, and edits that
// landed on two blocks at once.
function newTabBlock(label = ""): TabBlock {
  return { id: crypto.randomUUID(), label, columns: emptyTabColumns() };
}
```
**A keyed-`{#each}` duplicate-key bug with a visible symptom:** typing in one tab block changed two. `crypto.randomUUID()` — the same identity strategy as [`db.ts`](../../lib/db.ts.md)'s `createNote`.

## Bug 2 — inferred note type
```ts
/**
 * Chosen, not inferred. This used to be derived from "are there lyrics?" at
 * save time, so clearing the lyrics field silently turned a chord sheet
 * into a tab note and took the reader's transpose controls with it.
 */
let noteType = $state<NoteType>("chords");
```
**A data-model lesson.** `NoteType` is the app's central discriminant (see [`types.ts`](../../lib/types.ts.md)); inferring it from content meant an empty field silently rewrote the note's identity — and `[`/`]` transpose disappeared from the reader. **Explicit user choice beats a heuristic** for anything that changes how a record is interpreted.

## Bug 3 — silent not-found on edit
```ts
// Bailing quietly here left a blank form that, on save, updated zero rows
// and still reported "Note updated" before navigating to a note that
// doesn't exist.
if (!note) { notFound = true; return; }
```
**Three failures compounding:** a blank form, a no-op UPDATE, and a success toast for nothing. The fix needs `notFound` state *and* [`updateNote`](../../lib/db.ts.md)'s boolean return — which is exactly why that function does a separate existence `SELECT`. Checked twice: on load, and again on save (`if (!updated) { notFound = true; … }`) in case the note is deleted while the form is open.

## Bug 4 — the preview debounce
```ts
/**
 * Trailing debounce rather than one rAF per change. A frame-coalesced
 * update still re-parsed the whole document up to 60x a second while
 * typing — extractChords over the full sheet, a transpose + parse pass, a
 * complete preview DOM rebuild, and a chord-shape lookup per chord.
 */
const PREVIEW_DEBOUNCE_MS = 180;

$effect(() => {
  const s = chordSheet; const c = allChords; const t = tabBlocks; const p = pattern;
  const timer = setTimeout(() => { previewSheet = s; previewChords = c; previewTabBlocks = t; previewPattern = p; }, 180);
  return () => clearTimeout(timer);
});
```
**A textbook trailing debounce as a Svelte effect.** The four `const` reads at the top establish the dependencies *and* snapshot the values; the cleanup cancels the pending timer, so each keystroke restarts the countdown and only the last one fires.

**Two parallel state sets** — live (`chordSheet`, `allChords`, …) drive the editor, deferred (`preview*`) drive [`NotePreview`](NotePreview.svelte.md). The editor stays instant while the expensive render lags.

## Derived and state
```ts
const allChords = $derived(dedupe([...extractChords(chordSheet), ...manualChords]));
```
**Parsed chords plus manually-added ones, deduplicated.** This is what populates `Note.chords` — the denormalised column [`types.ts`](../../lib/types.ts.md) describes. `dedupe` is `[...new Set(list)]`, which preserves first-insertion order, so parsed chords lead.

**`addChord` checks `allChords` (not `manualChords`)** before appending — a chord already in the lyrics isn't re-added.

## The mobile pane as a history layer
```ts
// Below `lg`, switching to Preview is a real history step so back returns
// to Edit instead of leaving the page.
historyLayer(() => isCompact.current && mobilePane === "preview", () => (mobilePane = "edit"));
```
**A non-overlay use of [`historyLayer`](../../lib/overlay-history.svelte.ts.md).** Not a dialog — a *view mode*. But it behaves like one from the user's point of view: they moved "into" something and back should come out. The getter combines a breakpoint and a mode, so the layer only exists below `lg` where the panes actually take turns.

`closeAllLayers` is imported for the Cancel path — leaving the editor must unwind every stacked layer at once, which is the function's stated purpose.

## `insertAtCursor` and friends
```ts
if (!textareaEl) { chordSheet = chordSheet + text; return; }
const start = textareaEl.selectionStart ?? chordSheet.length;
const end = textareaEl.selectionEnd ?? start;
chordSheet = chordSheet.slice(0, start) + text + chordSheet.slice(end);
requestAnimationFrame(() => {
  if (!textareaEl) return;   // "The element can go away between scheduling and the frame firing."
  textareaEl.focus();
  const pos = start + text.length;
  textareaEl.setSelectionRange(pos, pos);
});
```
**Splice at the selection**, replacing it if there is one (`start`…`end`). **Append as a fallback** when the textarea isn't mounted — the tab pane doesn't render it.

**`requestAnimationFrame` before restoring the caret** — Svelte must flush the new value first, or `setSelectionRange` runs against the old text. The null re-check inside is the documented guard.

Three thin wrappers: `insertChord` → `[Am]`, `insertStrum` → `{D}`, and:
```ts
function insertTabRef(label: string) {
  const before = chordSheet.slice(0, start);
  const lead = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  insertAtCursor(`${lead}[tab: ${label}]\n`);
}
```
**`lead` forces the reference onto its own line** — because [`parse.ts`](../../lib/music/parse.ts.md)'s `TABREF_RE` is anchored (`^\s*\[tab:…\]\s*$`), so a mid-line reference simply wouldn't parse. **The editor encodes the parser's grammar requirement.** Two conditions: not at the very start, and not already after a newline.

## `handleFetchLyrics`
```ts
if (chordSheet.trim()) {
  toast("Replace chord sheet with fetched lyrics?", { action: { label: "Replace", onClick: () => { chordSheet = lyrics; } } });
} else { chordSheet = lyrics; }
```
**A toast with an action button as the confirmation** — non-blocking, unlike the `confirm()` used for destructive actions elsewhere. Right choice: overwriting an in-progress draft is reversible-ish and shouldn't halt the app. Note that ignoring the toast means *nothing happens*, which is the safe default.

## `save()`
```ts
const filledTabs = tabBlocks.filter(tabBlockFilled);
chordSheet: hasSheet ? chordSheet : undefined,
tabBlocks: filledTabs.length ? filledTabs : undefined,
strummingPattern: pattern.some(s => s !== "") ? pattern : undefined,
bpm: Number.isFinite(bpm) && (bpm as number) > 0 ? bpm : undefined,
```
**Every optional field is normalised to `undefined` when empty** — which [`db.ts`](../../lib/db.ts.md) then stores as `NULL`. Four different emptiness tests for four different shapes: whitespace-only string, empty-after-filter array, all-rests pattern, non-positive number. **`Number.isFinite` guards `NaN`**, which a `<input type="number">` produces when cleared — the same check [`backup.ts`](../../lib/backup.ts.md)'s `normalizeNote` applies to imported data.

**`tabBlockFilled`** drops blocks the user created but never filled, so a stray empty "Intro" isn't persisted.

**`editId ? updateNote : createNote`** — the create/edit branch, the payoff for [`CreatePage`](../../pages/CreatePage.svelte.md) routing both URLs here.

**`finally { saving = false }`** — the button re-enables on every path.

**`Ctrl/Cmd+S`** via `<svelte:window onkeydown>` with `preventDefault` to suppress the browser's Save dialog. The shortcut [`KeyboardShortcutsHelp`](../KeyboardShortcutsHelp.svelte.md) documents under "Note editor".

## Template shape
Two columns at `lg` (editor / preview, each independently scrolling — which is what [`CreatePage`](../../pages/CreatePage.svelte.md)'s `min-h-0 flex-1 overflow-hidden` exists to enable), collapsing below `lg` to a single pane toggled by `mobilePane`. `notFound` short-circuits the whole thing with a dedicated empty state offering two ways out.

**`KEYS`, `DIFFICULTY_ITEMS`, `TUNING_ITEMS` are duplicated from [`SettingsPage`](../../pages/SettingsPage.svelte.md)** — the fifth chromatic-scale copy and the fourth difficulty list in the codebase.

**Related:** [`lib/db.ts`](../../lib/db.ts.md), [`lib/music/parse.ts`](../../lib/music/parse.ts.md), [`lib/lyrics.ts`](../../lib/lyrics.ts.md), [`lib/overlay-history.svelte.ts`](../../lib/overlay-history.svelte.ts.md), [`NotePreview.svelte`](NotePreview.svelte.md), [`TabEditor.svelte`](TabEditor.svelte.md), [`ChordPanel.svelte`](ChordPanel.svelte.md)
