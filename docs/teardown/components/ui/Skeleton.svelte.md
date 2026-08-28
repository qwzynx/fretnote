# `src/components/ui/Skeleton.svelte`

**Role:** A shimmering placeholder block shown while data loads. **Size:** 50 lines.
**Notable:** one of the few components with a `<style>` block.

## The comment states the purpose

> *"A shimmering placeholder block. The point is to **reserve the space the real content will take**, so nothing jumps when data arrives — every loading state in the app used to be a one-line 'Loading…' that a whole card grid then shoved out of the way."*

**Layout stability, not decoration.** A "Loading…" line is ~20px tall; the grid that replaces it is hundreds. The page visibly lurches. A skeleton occupies the real dimensions, so the arriving content slots in without motion — the metric browsers call Cumulative Layout Shift.

The comment's "used to be" is the tell: several pages still use a bare "Loading…" ([`SetlistsPage`](../../pages/SetlistsPage.svelte.md), [`NotePage`](../../pages/NotePage.svelte.md), [`SetlistPage`](../../pages/SetlistPage.svelte.md)). Only the feed was converted.

## The script and markup

```svelte
let { class: className = "", ...rest }: { class?: string; [key: string]: unknown } = $props();
```
```svelte
<div aria-hidden="true" class={cn("skeleton rounded-md bg-surface-2", className)} {...rest}></div>
```

**No `children`** — a skeleton is a shape, never a container. The only `ui/` primitive besides `Separator` and `Slider` without it.

**`aria-hidden="true"`** — the correct accessibility choice, and easy to get wrong. A screen reader announcing a decorative grey box is noise; the *meaningful* announcement is a `role="status"` live region, which [`FeedPage`](../../pages/FeedPage.svelte.md) provides separately (`<span class="sr-only" role="status">Loading your notes…</span>`). **Two components cooperating**: this one is silent, the page speaks.

**`bg-surface-2`** — one step above `--surface-1` (cards), so the placeholder reads as slightly raised rather than as a hole.

**Dimensions come entirely from `className`** — the caller sizes each block to match the content it stands in for. That's what makes the space-reservation work, and it's why [`NoteCardSkeleton`](../feed/NoteCardSkeleton.svelte.md) exists: it composes several `Skeleton`s into a card-shaped arrangement.

## The `<style>` block — scoped CSS

```css
.skeleton { position: relative; overflow: hidden; }
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent,
    color-mix(in oklch, var(--foreground) 7%, transparent), transparent);
  animation: skeleton-sweep 1.6s ease-in-out infinite;
}
@keyframes skeleton-sweep { 100% { transform: translateX(100%); } }
```

**Why a `<style>` block at all**, when everything else is Tailwind: this needs a **pseudo-element with a keyframe animation**. Tailwind can express neither — `::after` content and `@keyframes` are outside the utility model. Svelte's scoped styles are the right escape hatch.

**Svelte scopes these rules to this component** by adding a hash class, so `.skeleton` can't leak.

### The sweep mechanism

**`position: relative` on the parent, `absolute inset-0` on the pseudo-element** — the overlay exactly covers the box.

**`overflow: hidden`** clips the gradient as it travels, so it appears from one edge and disappears at the other rather than spilling over neighbours. Without it the shimmer would be visible outside the block.

**The gradient is `transparent → tint → transparent`** — a soft band of light, not a hard edge.

**`translateX(-100%)` → `translateX(100%)`** — the band starts fully off the left edge and ends fully off the right, so it sweeps across and clears. A 200% total travel.

**Animating `transform`, not `background-position`** — compositor-only, so the shimmer costs no layout or paint. Important because these render many at a time.

**`color-mix(in oklch, var(--foreground) 7%, transparent)`** — derived from the palette rather than a hardcoded white, so it tracks the theme. Mixing in OKLCH keeps the fade perceptually even. Same technique as the scrollbar colours in [`globals.css`](../../app/globals.css.md).

**7%** is deliberately faint — enough to read as motion, not enough to compete with real content.

**`1.6s ease-in-out infinite`** — slow enough to be calming. `ease-in-out` makes the band accelerate in and decelerate out rather than crossing at constant speed.

### The reduced-motion override

```css
/* The base layer already flattens durations under this preference, but an
   infinite sweep needs stopping outright rather than speeding up. */
@media (prefers-reduced-motion: reduce) {
  .skeleton::after { animation: none; }
}
```

**A genuinely sharp observation.** [`globals.css`](../../app/globals.css.md)'s global rule sets `animation-duration: 0.01ms !important` — which for a *finite* animation means "effectively instant, done." For an **infinite** one it means a sweep completing 60,000 times a second: a strobing block, which is dramatically worse for exactly the users the preference protects.

`animation: none` stops it outright. **The blanket rule is right for finite animations and actively harmful for infinite ones**, and this is the only place in the codebase that needed to know the difference.

## Control flow

None in the script. The only branching is the media query.

---

## Related
- [`components/feed/NoteCardSkeleton.svelte`](../feed/NoteCardSkeleton.svelte.md) — composes these into a card shape
- [`pages/FeedPage.svelte`](../../pages/FeedPage.svelte.md) — pairs it with a `role="status"` live region
- [`app/globals.css`](../../app/globals.css.md) — the reduced-motion rule this must override
