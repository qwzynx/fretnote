# `src/components/create/StrumPanel.svelte`
**Role:** Five buttons that insert a `{D}`-style strum marker at the cursor. **33 lines.**

```ts
const STROKES: StrokeType[] = ["D", "U", "d", "u", "X"];
```
**`STROKE_CYCLE` minus the rest (`""`)** — a rest has no inline syntax (see [`parse.ts`](../../lib/music/parse.ts.md)'s `INLINE_MARKER_RE`, whose class is `[DUduX]`), so there's nothing to insert. A separate array rather than `STROKE_CYCLE.filter(s => s !== "")` — a fourth ordering of the same five values in the codebase.

## Rendering
```svelte
{@const info = STROKE_DISPLAY[s]}
<span class={cn("text-lg font-bold leading-none", info.className)}>{info.symbol}</span>
<span class="text-3xs text-muted-foreground">{s}</span>
```
**Both the glyph *and* the letter code are shown.** Necessary, because `D`/`d` and `U`/`u` share a symbol — [`strumming.ts`](../../lib/strumming.ts.md) distinguishes them by colour alone. On a button that small, colour isn't enough, so the raw code disambiguates. **A genuine accessibility improvement over relying on `info.className`.**

**`title="Insert {'{' + s + '}'} — {info.label}"`** — the awkward concatenation is because `{` in a Svelte template starts an expression; it can't be written literally. The tooltip teaches the syntax while naming the stroke.

All three fields of `STROKE_DISPLAY` are used here: `symbol`, `label`, `className`.

**`onInsert(stroke)` is a plain callback** — this component knows nothing about the textarea. [`CreateNoteForm`](CreateNoteForm.svelte.md) owns cursor position.

**`h-10 w-12 … sm:h-9 sm:w-11`** — touch-first sizing.

**Related:** [`lib/strumming.ts`](../../lib/strumming.ts.md), [`lib/music/parse.ts`](../../lib/music/parse.ts.md), [`StrummingEditor.svelte`](StrummingEditor.svelte.md)
