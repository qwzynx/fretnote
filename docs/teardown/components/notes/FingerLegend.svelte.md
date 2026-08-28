# `src/components/notes/FingerLegend.svelte`
**Role:** A key explaining the finger numbers on fretboard diagrams. **24 lines.**

```svelte
{#each FINGERS as finger}
  <span class="flex items-center gap-1">
    <span class="flex size-3.5 items-center justify-center rounded-full bg-primary font-mono text-[0.5rem] font-bold leading-none text-primary-foreground">
      {finger}
    </span>
    {FINGER_LABELS[finger]}
  </span>
{/each}
```

**The only reason `FINGERS` exists as an array** in [`fingering.ts`](../../lib/music/fingering.ts.md). `Finger` is a type (`1|2|3|4`) and types can't be iterated at runtime — so the module exports a parallel array purely so this loop can exist. Worth noting as a small but real cost of type-level enumerations.

**`FINGER_LABELS[finger]`** is `Record<Finger, string>`, so the index is exhaustively type-checked: adding a fifth finger to the union would fail to compile until a label is added.

## Styling
The numbered circle **mirrors the dots drawn by [`FingerFretboard`](FingerFretboard.svelte.md) and [`ChordDiagram`](ChordDiagram.svelte.md)** — `bg-primary`, `text-primary-foreground`, mono, bold. That visual match is the entire point of a legend; it only works because all three use the same tokens.

**`size-3.5` (14px)** — smaller than the 12px-radius SVG dots, since this is inline with `text-3xs` copy.

**`text-[0.5rem]`** is an arbitrary value (8px) — smaller than the 10px `--text-3xs` token, which is already the smallest in the scale. A one-off rather than a new token.

**`leading-none`** — without it, the line-height would make the circle taller than wide and break the `rounded-full` shape into an oval. The same reason `Label.svelte` uses it.

**`flex-wrap gap-x-2.5 gap-y-1`** on the container — four items wrap onto two lines on narrow screens.

**It's a `<p>`, not a `<ul>`** — arguably a list semantically, but as inline glossary text a paragraph reads acceptably to a screen reader.

**No props but `class`**, no state, no conditionals. One loop.

**Related:** [`lib/music/fingering.ts`](../../lib/music/fingering.ts.md), [`FingerFretboard.svelte`](FingerFretboard.svelte.md), [`ChordDiagram.svelte`](ChordDiagram.svelte.md)
