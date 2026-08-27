# `src/lib/sections.ts`

**Role:** Defines which routes count as top-level "sections" and their left-to-right order, for phone swipe navigation.
**Size:** 11 lines. **Depends on:** nothing.

---

## Full source, annotated

```ts
export const SECTION_ORDER = ["/", "/setlists", "/settings"] as const;

export function sectionIndex(path: string): number {
  return SECTION_ORDER.indexOf(path as (typeof SECTION_ORDER)[number]);
}
```

## `SECTION_ORDER`

Three of the app's seven routes. Compare against `App.svelte`'s route table:

| Route | Section? | Why |
|---|---|---|
| `/` (Feed) | ✅ index 0 | Top-level destination |
| `/setlists` | ✅ index 1 | Top-level destination |
| `/settings` | ✅ index 2 | Top-level destination |
| `/create` | ❌ | A task you enter and leave, not a place |
| `/notes/:id` | ❌ | A detail view — *inside* the feed conceptually |
| `/notes/:id/edit` | ❌ | Same |
| `/setlists/:id` | ❌ | A detail view *inside* setlists |

The distinction is **place vs. task/detail**. Sections are peers you flip between horizontally; everything else is a push onto a stack you pop back out of. This is the standard mobile navigation model (think tab bar + drill-down), and getting this split right is what makes the back gesture feel correct.

### `as const`

Without it, TypeScript infers `string[]`. With it, the type is the readonly tuple `readonly ["/", "/setlists", "/settings"]`. Two consequences:

1. **Immutability.** `SECTION_ORDER.push("/foo")` is a compile error. Since this array's order encodes UI layout, accidental mutation would be a genuine bug.
2. **Literal member type.** `(typeof SECTION_ORDER)[number]` becomes the union `"/" | "/setlists" | "/settings"` rather than `string`. That's what makes the cast in `sectionIndex` meaningful.

### The comment is a warning, not a description

> *"Order must match the left-to-right order of `ITEMS`/`TRAILING` in `src/components/layout/BottomNav.svelte`."*

This is an **unenforced invariant between two files.** The bottom nav renders the tabs left-to-right in its own order; this array defines which direction a swipe moves you. If they disagree, swiping left visually moves you to the tab on the right — a bug that no type checker or test will catch, and that feels "wrong" in a way users struggle to articulate.

When you get to `BottomNav.svelte`, check this by hand. It's the kind of coupling worth remembering exists.

---

## `sectionIndex(path)`

```ts
export function sectionIndex(path: string): number {
  return SECTION_ORDER.indexOf(path as (typeof SECTION_ORDER)[number]);
}
```

**What it returns:** `0`, `1`, `2`, or `-1`.

The `-1` is the interesting value and it's what the function is really for. It answers a yes/no question — "is this a swipeable section?" — while also giving the position. Callers use it two ways:

```ts
if (sectionIndex(path) === -1) { /* not a section: don't allow swiping */ }
const next = SECTION_ORDER[sectionIndex(path) + 1];  // swipe left
```

**The cast, and why it's needed:** `SECTION_ORDER` is a readonly tuple of literals, so its `indexOf` is typed to accept only `"/" | "/setlists" | "/settings"`. Passing a general `string` is a type error — TypeScript is objecting that the argument *can't possibly* be found. But "can't possibly be found" is precisely the case we want to detect at runtime.

The cast asserts "trust me, compare it anyway." At runtime `indexOf` does a plain `===` scan and returns `-1` for a non-member, which is the desired behaviour. This is a case where the cast makes the code *more* correct, not less — it's working around a type signature that's too strict for this use.

**Why not `SECTION_ORDER.includes(path)` plus a separate lookup:** Same cast problem, and it'd be two passes. `indexOf` gives membership and position in one call.

**Exact match, no normalisation:** `sectionIndex("/settings/")` returns `-1`. So does `"/Settings"`. The router (`svelte-spa-router`) produces canonical paths, so this hasn't bitten anyone — but it's a hardcoded assumption. A query string (`/settings?tab=x`) would also miss.

**No loops** — `indexOf` does the iteration internally, over three elements.

---

## Where this fits

This module is pure data + one lookup, with no imports at all. That's why the swipe machinery in `nav-stack.svelte.ts` and `SectionSwipe.svelte` can import it freely without cycles. Keeping the *policy* (which routes are sections, in what order) in a leaf module separate from the *mechanism* (gesture handling, history) is the reason those files stay tractable.

---

## Related

- [`components/layout/BottomNav.svelte`](../components/layout/BottomNav.svelte.md) — the order this must match
- [`components/layout/SectionSwipe.svelte`](../components/layout/SectionSwipe.svelte.md) — the gesture consumer
- [`lib/nav-stack.svelte.ts`](nav-stack.svelte.ts.md) — history/back-gesture logic
- [`App.svelte`](../App.svelte.md) — the full route table this is a subset of
