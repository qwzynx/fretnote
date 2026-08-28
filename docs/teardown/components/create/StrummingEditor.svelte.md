# `src/components/create/StrummingEditor.svelte`
**Role:** The tap-to-cycle strum grid with beat labels and bar management. **146 lines.**

## `cycleStroke(idx)`
```ts
const next = [...pattern] as StrokeType[];
next[idx] = STROKE_CYCLE[(STROKE_CYCLE.indexOf(cur) + 1) % STROKE_CYCLE.length];
onChange(next);
```
**The modulo-step advance through [`STROKE_CYCLE`](../../lib/strumming.ts.md)** — that array's *order* is this interaction. `% length` wraps, so tapping past the rest returns to `D`.

**Copy-then-mutate-then-emit** — the prop array is never mutated. Required for a controlled component whose parent holds the state.

**A stroke not in `STROKE_CYCLE` gives `indexOf` = `-1`, so `(-1 + 1) % 6 = 0` → `"D"`.** Accidentally graceful: unknown data resets to a valid value rather than crashing.

## Bar operations
```ts
function addBar()    { onChange([...pattern, ...(Array(subdivision).fill("") as StrokeType[])]); }
function removeBar() { if (pattern.length > subdivision) onChange(pattern.slice(0, -subdivision)); }
function reset()     { onChange(Array(subdivision).fill("") as StrokeType[]); }
```
**`Array(n).fill("")`** — the dense-array idiom from `emptyPattern()`; `fill` is required or the array is holes.

**`removeBar`'s guard keeps at least one bar** — the same condition is *also* the button's `disabled`, so it's enforced twice.

**All three operate in units of the current `subdivision`** — so switching to 16ths and adding a bar appends 16 slots, not 8. **Nothing re-quantises the existing pattern** when `subdivision` changes: an 8-slot pattern viewed as 16ths becomes half a bar. `bars = Math.ceil(length / subdivision)` handles the ragged case, and `slots` is a `slice` that can come back short. Arguably surprising, but it degrades cleanly.

## `isDownbeat`
```ts
const isDownbeat = (i: number) => i % (subdivision === 8 ? 2 : 4) === 0;
```
**Every 2nd slot in 8ths, every 4th in 16ths** — i.e. the numbered beats (1, 2, 3, 4) rather than the `&`/`e`/`a` subdivisions. Drives bold labels and a stronger border, so the eye can find the pulse. Purely visual, and it's what turns a row of boxes into readable rhythmic notation.

## The grid
```svelte
{#each Array.from({length: bars}, (_, bar) => bar) as bar}
  {@const start = bar * subdivision}
  {@const slots = pattern.slice(start, start + subdivision)}
```
**Two nested loops per bar** — labels, then buttons — kept as separate flex rows so the label sits above its box without a per-slot wrapper.

**`labels[(start + i) % subdivision]`** — the label array is one bar long and repeats across bars.

**`isDownbeat(start + i)`** uses the *absolute* index, so bar 2 beat 1 is still a downbeat.

**Button classes stack four `cn` arguments:** base, downbeat/offbeat border, `stroke !== "" && "border-primary/40 bg-primary/5"` (filled slots stand out), and `info.className` (the stroke's own colour). Four independent signals on one element.

**`overflow-x-auto … sm:flex-wrap`** — *"scrolls sideways on phones rather than splitting a bar across rows"*, because a bar broken mid-way is unreadable as rhythm. **Note: no `data-no-swipe-nav`**, unlike the other horizontal scrollers — the editor isn't on a swipeable section route, so it doesn't conflict.

**The subdivision toggle** is a segmented control using `{#each [8, 16] as sub}` with `sub as 8 | 16` casts, since the literal array infers as `number[]`.

**Related:** [`lib/strumming.ts`](../../lib/strumming.ts.md), [`StrummingPreview.svelte`](StrummingPreview.svelte.md), [`CreateNoteForm.svelte`](CreateNoteForm.svelte.md)
