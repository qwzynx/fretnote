# `src/components/create/FretboardInput.svelte`
**Role:** A tappable fretboard grid for building a chord voicing or hand shape. **158 lines.**

## `allowUnset` — the prop that changes the state machine
> *"When true, a string starts 'not decided' instead of muted, and the open/muted marker cycles through that third state. Only meaningful for callers (like the chord finder) that hand `UNSET_FRET` strings on to `detectChord`, which guesses them open or muted itself — a hand shape that gets saved verbatim (e.g. the tab fingering picker) should stay off this so every string always resolves to a concrete state."*

**The clearest statement of `UNSET_FRET`'s purpose in the codebase.** [`ChordPanel`](ChordPanel.svelte.md) passes `allowUnset` because its output goes to `detectChord`, which enumerates the unknowns. [`TabFingeringPanel`](TabFingeringPanel.svelte.md) doesn't, because its output is *saved* as a `TabHint` — and [`types.ts`](../../lib/types.ts.md) has no "unset" value, so every string must resolve.

## The marker cycle
```ts
setString(s, isUnset ? 0 : isOpen ? -1 : isMuted && allowUnset ? UNSET_FRET : -1)
```
**A nested ternary encoding two different cycles:**

| `allowUnset` | Cycle |
|---|---|
| `true` | unset → open → muted → unset |
| `false` | open → muted → muted (…) |

The final `: -1` catches "currently fretted" — tapping the marker mutes the string regardless of mode. In `false` mode the `isMuted && allowUnset` test fails, so muted → `-1` again, and the third state is unreachable. **One expression, two state machines, selected by a boolean.**

The parallel `title` ternary spells each transition out in words — five distinct tooltips.

## The fret-cell cycle
```ts
onclick={() => setString(s, active ? (allowUnset ? UNSET_FRET : 0) : f)}
```
Tapping an inactive cell frets it; tapping the **active** one clears it — to `UNSET_FRET` or to open, matching the mode.

## Rendering
**`STRING_ORDER = [0,1,2,3,4,5]`** — **not reversed.** A fretboard is drawn with strings as *vertical columns*, low-E on the left, which is the same direction as storage. Unlike the tab renderers, no flip. (Compare [`TabEditor`](TabEditor.svelte.md)'s `DISPLAY_ORDER = [5,4,3,2,1,0]`, which *is* reversed because tabs are horizontal rows.)

**`const col = "w-10 sm:w-9"` / `row = "h-11 sm:h-9"`** — class strings as constants, reused across five elements so the columns can't drift apart. *"Roomier cells on phones — this grid is tapped, not clicked."*

**The string lines are a separate `pointer-events-none absolute inset-0` layer** — drawn under the buttons so a 1px line never intercepts a tap. Without that, tapping exactly on a string would miss.

**`{fingering.fingers[s] || ""}`** in the dot — the live fingering from [`fingerShape`](../../lib/music/fingering.ts.md), recomputed as you tap. `|| ""` hides a `0`.

**`aria-label={\`String ${stringNames[s]}, fret ${f}${active ? " (active, click to clear)" : ""}\`}`** — a fully descriptive name per cell, including state. 30 buttons, each individually announced. Better accessibility than most of the codebase.

**`export type Frets`** from a `.svelte` file — legal, and imported by both panels.

**Related:** [`lib/music/chord-detect.ts`](../../lib/music/chord-detect.ts.md), [`ChordPanel.svelte`](ChordPanel.svelte.md), [`TabFingeringPanel.svelte`](TabFingeringPanel.svelte.md)
