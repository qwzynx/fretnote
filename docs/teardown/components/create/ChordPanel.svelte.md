# `src/components/create/ChordPanel.svelte`
**Role:** The chord finder — search by name, or detect from tapped frets. **209 lines.**

**Where [`chords.ts`](../../lib/music/chords.ts.md) and [`chord-detect.ts`](../../lib/music/chord-detect.ts.md) meet the UI**, one for each direction of the same relationship.

## The two modes
```ts
let mode = $state<"search" | "detect">("search");
const searchResult = $derived(trimmed ? getChordShape(trimmed) : null);
const detected = $derived(detectChord(frets, tuning));
const active = $derived(mode === "search" ? (searchResult ? trimmed : null) : detected);
```
**`active` is the single value the result column renders**, collapsing two independent pipelines into one. Note the search branch yields `trimmed` (the *name*) only when `getChordShape` finds a shape — so an unresolvable name shows the error message instead of a broken diagram.

**Both derivations run continuously**, even for the inactive mode. Cheap because `getChordShape` memoises (including misses — see `chords.ts`); `detectChord` doesn't memoise but only recomputes when `frets` changes.

## `EMPTY_FRETS`
```ts
const EMPTY_FRETS: Frets = [UNSET_FRET, UNSET_FRET, UNSET_FRET, UNSET_FRET, UNSET_FRET, UNSET_FRET];
```
**All six strings start `UNSET_FRET` (−2), not muted.** This is the whole point of that third state: *"Tap the fretted notes — blank strings are guessed"*. Tapping the two notes of an Em shape is enough, because `detectChord` tries every open/muted combination for the rest. See [`chord-detect.ts`](../../lib/music/chord-detect.ts.md).

**`[...EMPTY_FRETS] as Frets`** at both use sites — a fresh copy, since `frets` is mutated by the fretboard. The same shared-constant discipline as `settings.ts` and `strumming.ts`.

## `place(name)`
```ts
function place(name: string) { if (onInsert) onInsert(name); else onAddChord(name); }
```
**`onInsert` is optional, and its presence changes the component's whole purpose.** With it (chord-sheet mode) a quick-chord button inserts `[Am]` at the cursor; without it (tab mode) it adds the chord to the note's chord list. The header copy branches on the same prop:

```svelte
{onInsert ? "Find a shape, then drop it into your lyrics at the cursor." : "Look up a shape and add it to the note."}
```

**One optional callback driving text, button set, and click behaviour** — a clean way to express two closely-related modes without a `mode` prop.

## Details
- **`{@const Icon = m.Icon}`** — the capitalisation rename needed to render a component from a variable, same as [`EmptyState`](../ui/EmptyState.svelte.md).
- **`{@const added = chords.includes(name)}`** tints quick-chord buttons already on the note.
- **`alreadyAdded`** turns the Add button into a disabled "On note" with a `Check` icon — state shown rather than an error on re-click.
- **The tuning `<Select>` only appears in detect mode**, because tuning affects `tuning.midi[s] + fret` and therefore what the frets *sound* as. Search doesn't need it — a chord name is tuning-independent.
- **`TUNING_ITEMS`** is a *third* copy of the `TUNINGS.map(...)` transform (also in `SettingsPage`).
- **`allowUnset`** on [`FretboardInput`](FretboardInput.svelte.md) enables the third tap state.
- **`{#if active}` / `{:else}`** — the result column shows a mode-specific prompt when there's nothing to draw, rather than an empty box.
- **`min-w-full flex-1 … sm:min-w-[14rem]`** — the input side takes the full width on phones, forcing the result column onto its own row.

**Related:** [`lib/music/chords.ts`](../../lib/music/chords.ts.md), [`lib/music/chord-detect.ts`](../../lib/music/chord-detect.ts.md), [`FretboardInput.svelte`](FretboardInput.svelte.md), [`components/notes/ChordDiagram.svelte`](../notes/ChordDiagram.svelte.md)
