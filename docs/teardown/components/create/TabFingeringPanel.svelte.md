# `src/components/create/TabFingeringPanel.svelte`
**Role:** Picks the hand shape for a tab block — suggested, by chord name, or by tapping frets. **323 lines.**

**The UI for [`tab-shapes.ts`](../../lib/music/tab-shapes.ts.md)**, and the most sophisticated authoring component in the app.

## The three-source state pattern
```ts
let chosen    = $state<{frets: Frets; shape?: string} | null>(null);
let tapped    = $state<Frets | null>(null);
let typedNote = $state<string | null>(null);

// Each of these follows whatever the tab already recommends until the author
// chooses something else, so the panel stays in step with the block.
const picked   = $derived(chosen ?? (hintFrets ? {frets: hintFrets, shape: block.hint?.shape} : null));
const manual   = $derived(tapped ?? hintFrets ?? EMPTY_FRETS);
const noteText = $derived(typedNote ?? block.hint?.note ?? "");
```
**Each local starts `null` meaning "not overridden", and each derived falls back through the saved hint.** So the panel opens showing whatever is already on the block, and the moment the author touches a control the local takes over.

**`null` as "no local override" rather than a separate `dirty` flag** — three variables, three fallback chains, no extra bookkeeping. `?? ` (not `||`) throughout, so a legitimately empty note string isn't overwritten.

## `active` — one grip from three modes
```ts
const active = $derived.by(() => {
  if (mode === "search") return searchShape ? {frets: [...searchShape.frets], shape: trimmed} : null;
  if (mode === "frets")  return manual.some(f => f > 0) ? {frets: manual, shape: detectChord(manual, tuning) ?? undefined} : null;
  return picked;
});
```
Same collapse-to-one-value idea as [`ChordPanel`](ChordPanel.svelte.md)'s `active`, with three branches.

**The `frets` branch runs `detectChord` to *name* what the author tapped** — so a hand-built grip still gets "Em" attached if it is one. `?? undefined` because `TabHint.shape` is optional.

**`manual.some(f => f > 0)`** — an all-muted board isn't a grip.

## `saved` — a value-equality check
```ts
const saved = $derived(
  !!block.hint && !!active &&
  block.hint.frets.join() === active.frets.join() &&
  (block.hint.note ?? "") === noteText.trim()
);
```
**`frets.join()` compares arrays by value** — the same canonical-string trick used for dedup in [`chords.ts`](../../lib/music/chords.ts.md) and [`tab-shapes.ts`](../../lib/music/tab-shapes.ts.md), here for equality. `join()` with no argument uses `,`.

Drives the Save button's `disabled` + "On tab" label — **the button shows saved-ness rather than being always-clickable**, so the author can see at a glance whether their edit is applied. Note the note text is included, so editing only the tip re-enables Save.

## `save` / `clear`
`save()` writes a `TabHint` with `note: noteText.trim() || undefined` — an empty tip is stored as absent, matching the optional field. `clear()` resets **all three locals** as well as removing the hint, so the panel returns to its blank state rather than showing a stale override.

## The suggestions UI
```svelte
{#if suggestions.length === 0}
  {#if demand.notes.length === 0} Add fret numbers…
  {:else} No single shape holds this tab — it moves along the neck. Use the positions below… {/if}
```
**Two different empty states for two different reasons** — nothing tabbed yet, versus tabbed but unfittable. The second is exactly the case [`suggestTabShapes`](../../lib/music/tab-shapes.ts.md)'s 50% filter is designed to produce, and the copy explains it honestly rather than showing a bad suggestion.

```svelte
{s.covered === s.total ? "all" : `${s.covered}/${s.total}`}
```
**Coverage on every chip**, with "all" highlighted in primary — so the author can trade off a full-coverage barre against a partial open shape.

```svelte
{#if positions.length === 1} Stays at fret {positions[0].position} throughout.
{:else} Hand moves: {#each positions as p, i}{i > 0 ? " → " : ""}fret {p.position} ({columnRange(p.fromColumn, p.toColumn)}){/each}
```
**Renders `tabPositions`' run-length output as a readable sentence.** `columnRange` collapses `from === to` to `"column 3"` and otherwise `"columns 3–7"`, and converts 0-based indices to 1-based for display. The `i > 0 ? " → " : ""` is the standard join-inside-an-each idiom.

## The result panel
**Coverage explained in prose**, with three branches for `total === 0` / full / partial, plus a conditional second sentence:
```svelte
{#if coverage.blocked > 0} Lift {coverage.blocked === 1 ? "a finger" : "fingers"} for the open {…"string"/"strings"} {/if}
```
**Two pluralisations that must agree.** This is `ShapeCoverage.blocked` — strings the tab needs open that the grip frets — turned into an actionable instruction rather than a number. The clearest example in the codebase of a computed metric being translated into something a player can act on.

**`w-[8.5rem] sm:w-[152px]`** — the second unconverted instance of the values `--spacing-fretboard` was meant to replace (the other is [`TabHintView`](../notes/TabHintView.svelte.md)).

**`{@const Icon = m.Icon}`** — the component-from-variable rename, third occurrence.

**Related:** [`lib/music/tab-shapes.ts`](../../lib/music/tab-shapes.ts.md), [`lib/music/chord-detect.ts`](../../lib/music/chord-detect.ts.md), [`FretboardInput.svelte`](FretboardInput.svelte.md), [`components/notes/FingerFretboard.svelte`](../notes/FingerFretboard.svelte.md)
