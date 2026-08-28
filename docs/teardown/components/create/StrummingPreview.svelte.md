# `src/components/create/StrummingPreview.svelte`
**Role:** Read-only render of a strum pattern. **18 lines.**

```svelte
const hasStrokes = $derived(pattern.some(s => s !== ""));
{#if hasStrokes}
  <div class="flex flex-wrap gap-0.5 font-mono text-lg leading-none">
    {#each pattern as s}
      <span class={cn("w-5 text-center", STROKE_DISPLAY[s].className)}>{STROKE_DISPLAY[s].symbol}</span>
    {/each}
  </div>
{/if}
```

**`hasStrokes` renders nothing for an all-rest pattern.** [`emptyPattern()`](../../lib/strumming.ts.md) returns eight `""`s, so a note that never had a pattern edited would otherwise show eight faint dots. The same `.some(s => s !== "")` test appears in [`NoteReader`](../notes/NoteReader.svelte.md) and [`NotePreview`](NotePreview.svelte.md) — three copies.

**`w-5 text-center`** — a fixed width per slot, so `↓`, `↑`, `✕` and `·` all occupy the same column and the pattern reads as an even grid. Without it the narrow `·` would collapse and the rhythm would be unreadable.

**No beat labels**, unlike [`StrummingEditor`](StrummingEditor.svelte.md) — this is a compact read-only glance, not a counting aid.

**`STROKE_DISPLAY[s]` is indexed twice** rather than hoisted to a `{@const}`; two object lookups, negligible.

**Note the type is `StrokeType[]` while `Note.strummingPattern` is `string[]`** — so every caller from a stored note casts. See [`types.ts`](../../lib/types.ts.md).

**Related:** [`lib/strumming.ts`](../../lib/strumming.ts.md), [`components/notes/NoteReader.svelte`](../notes/NoteReader.svelte.md)
