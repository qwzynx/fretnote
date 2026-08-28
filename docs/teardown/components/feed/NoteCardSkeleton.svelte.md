# `src/components/feed/NoteCardSkeleton.svelte`
**Role:** A grid of card-shaped loading placeholders. **34 lines.**

> *"Mirrors NoteCard's structure and the feed's grid, so the real cards drop straight into the space these were holding."*

**The whole point is dimensional fidelity.** The outer grid classes (`grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3`) are copied verbatim from `FeedClient`, and the inner block copies `NoteCard`'s padding, border, and footer. So when data arrives the layout doesn't shift by a pixel.

**The cost:** this is duplicated markup. Change `NoteCard`'s padding and the skeleton silently stops matching. An unenforced coupling, like `SUMMARY_COLUMNS` ↔ `NoteSummary`.

## The loop
```svelte
{#each Array.from({ length: count }, (_, i) => i) as i (i)}
```
**`Array.from({ length: n }, (_, i) => i)`** builds `[0,1,…n-1]`. The mapping function is required — `Array.from({length: 6})` alone gives `[undefined × 6]`, which works for iteration but gives no index to key by. (`Array(n).fill()` is the other idiom, used in [`strumming.ts`](../../lib/strumming.ts.md).)

**Keyed by `(i)`** — index-keying, normally an anti-pattern, but correct here: the items are identical and never reorder.

**`count = 6` default** — enough to fill the visible grid at all three breakpoints.

## The proportions
`w-3/5` for the title, `w-2/5` for the artist, three chips of `w-9`/`w-7`/`w-8` — **deliberately uneven**, because real titles are uneven. Uniform bars read as a progress indicator rather than as content.

`rounded-full` on the type badge matches [`Badge`](../ui/Badge.svelte.md); `rounded-sm` on the chord chips matches those.

**Related:** [`components/ui/Skeleton.svelte`](../ui/Skeleton.svelte.md), [`components/notes/NoteCard.svelte`](../notes/NoteCard.svelte.md), [`pages/FeedPage.svelte`](../../pages/FeedPage.svelte.md)
